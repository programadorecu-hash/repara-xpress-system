from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from sqlalchemy.orm import Session
from datetime import date
from fastapi import File, UploadFile

from fastapi.responses import StreamingResponse, PlainTextResponse
from slowapi import Limiter                      # Núcleo del limitador
from slowapi.util import get_remote_address      # Cómo identificar al cliente (por IP)
from slowapi.errors import RateLimitExceeded     # Error cuando se excede el límite
from slowapi.middleware import SlowAPIMiddleware # Middleware que activa el limitador
from starlette.requests import Request           # Tipo de request para el handler

from starlette.middleware.base import BaseHTTPMiddleware

import shutil
import os
import uuid

# --- Helpers para nombres de carpeta/archivo por producto ---
import re
import unicodedata

# ===================================================================
# --- HELPER PARA QUE LAS IMAGENES SE GUARDEN POR NOMBRES Y CARPETAS  ---
# ===================================================================

def _slugify(text: str, case: str = "lower") -> str:
    """
    Normaliza texto:
    - quita acentos
    - reemplaza cualquier caracter no alfanumérico por '_'
    - colapsa múltiples '_' seguidos
    - quita '_' al inicio/fin
    - aplica minúsculas o mayúsculas según 'case'
    """
    if not text:
        return "producto"
    # quitar acentos
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    # reemplazar no alfanumérico por '_'
    text = re.sub(r"[^A-Za-z0-9]+", "_", text)
    # colapsar múltiples '_'
    text = re.sub(r"_+", "_", text).strip("_")
    if case == "upper":
        return text.upper()
    return text.lower()
# --- fin helpers ---


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Añade cabeceras de seguridad a TODAS las respuestas.
    - X-Frame-Options: evita que nos embeban en iframes (clickjacking).
    - X-Content-Type-Options: evita sniffing de tipos.
    - Referrer-Policy: restringe el referer.
    - Permissions-Policy: bloquea acceso a APIs del navegador que no usamos.
    - HSTS: solo se activa si estamos detrás de HTTPS (según cabecera del proxy).
    """
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        # Cabeceras seguras por defecto
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # HSTS solo si el tráfico viene por HTTPS (útil en despliegues detrás de proxy)
        if request.headers.get("x-forwarded-proto", "").lower() == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
# --- Fin cabeceras de seguridad ---

from . import pdf_utils

from . import models, schemas, crud, security
from .database import get_db

app = FastAPI(title="API de Inventarios de Repara Xpress")

app.mount("/uploads", StaticFiles(directory="/code/uploads"), name="uploads")

# --- MIDELWARE PARA CONECTAR EL FRONTEND ---
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
allowed = [o.strip() for o in cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,                 # Orígenes permitidos desde env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", "Content-Type", "Accept",
        "X-Requested-With", "Origin"
    ],
    expose_headers=["Content-Disposition"] # Necesario para descargas (PDFs)
)

# ===== Rate limiting: limitar intentos de login =====
# 1) Creamos el "guardia" que cuenta cuántas peticiones hace cada cliente (por IP)
limiter = Limiter(key_func=get_remote_address)

# 2) Guardamos el limitador en la app y activamos su middleware
app.state.limiter = limiter 
app.add_middleware(SlowAPIMiddleware)
# Activamos cabeceras de seguridad en todas las respuestas
app.add_middleware(SecurityHeadersMiddleware)

# 3) Mensaje claro cuando alguien se pasa del límite
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # 429 = Too Many Requests (demasiadas peticiones)
    return PlainTextResponse("Demasiados intentos, intenta más tarde.", status_code=429)
# ===== Fin rate limiting =====


# ===================================================================
# --- ENDPOINT RAÍZ ---
# ===================================================================

@app.get("/")
def read_root():
    return {"message": "¡Bienvenido a la API de Repara Xpress Quito!"}

# ===================================================================
# --- ENDPOINTS PARA USUARIOS Y AUTENTICACIÓN ---
# ===================================================================

@app.post("/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_new_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"]))
):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.get("/users/", response_model=List[schemas.User])
def read_users(db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    return crud.get_users(db)

@app.patch("/users/{user_id}", response_model=schemas.User)
def update_user_details(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    # La lógica para no eliminar al último admin está dentro de crud.update_user
    db_user = crud.update_user(db, user_id=user_id, user_update=user_update)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user

@app.post("/users/me/set-pin", response_model=schemas.User)
def set_current_user_pin(pin_data: schemas.UserSetPin, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return crud.set_user_pin(db=db, user_id=current_user.id, pin=pin_data.pin)

@app.post("/users/{user_id}/reset-password")
def reset_password_for_user(user_id: int, password_data: schemas.UserPasswordReset, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    db_user = crud.reset_user_password(db, user_id=user_id, new_password=password_data.new_password)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": f"Contraseña para el usuario {db_user.email} ha sido reseteada con éxito."}

@limiter.limit("5/minute")  # Máximo 5 intentos por minuto desde la misma conexión
@app.post("/token")
async def login_for_access_token(
    request: Request,  # <= NECESARIO para slowapi
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos", headers={"WWW-Authenticate": "Bearer"})
    access_token = security.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/profile", response_model=schemas.UserProfile)
def read_current_user_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    # Creamos un diccionario con los datos y lo pasamos al schema para validación/formato
    profile_data = current_user.__dict__
    profile_data['active_shift'] = active_shift
    return profile_data

# ===================================================================
# --- ENDPOINTS PARA CATEGORÍAS ---
# ===================================================================
@app.post("/categories/", response_model=schemas.Category, status_code=status.HTTP_201_CREATED)
def create_new_category(category: schemas.CategoryCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.create_category(db=db, category=category)

@app.get("/categories/", response_model=List[schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_categories(db, skip=skip, limit=limit)

# ===================================================================
# --- ENDPOINTS PARA PRODUCTOS ---
# ===================================================================
@app.post("/products/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_new_product(product: schemas.ProductCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.create_product(db=db, product=product)

@app.get("/products/", response_model=List[schemas.Product])
@limiter.limit("60/minute")  # Evita martillazos de búsqueda desde el frontend
def read_products(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    location_id: int | None = None, 
    db: Session = Depends(get_db)
    # No necesitamos el usuario actual aquí, la info de ubicación viene como parámetro
):
    # Pasamos los nuevos parámetros a la función CRUD
    return crud.get_products(db, skip=skip, limit=limit, search=search, location_id=location_id)

@app.get("/products/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db_product

@app.put("/products/{product_id}", response_model=schemas.Product)
def update_product_details(product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    db_product = crud.update_product(db, product_id=product_id, product=product)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para actualizar")
    return db_product

@app.delete("/products/{product_id}", response_model=schemas.Product)
def delete_product_by_id(product_id: int, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    db_product = crud.delete_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para eliminar")
    return db_product

@limiter.limit("10/minute")  # Subidas acotadas para evitar abuso/picos
@app.post("/products/{product_id}/upload-image/", response_model=schemas.Product)
def upload_product_image(
    request: Request,
    product_id: int,
    # ARREGLO: Le decimos a FastAPI que el archivo viene de un formulario
    # y que su "nombre de compartimiento" (alias) es "file".
    file: UploadFile = File(..., alias="file"),
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))
):
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
        # ===== VALIDACIÓN DE ARCHIVO (Producto) =====
    # 1) Extensiones permitidas
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    # 2) Tipos MIME permitidos
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    # 3) Tamaño máximo (5 MB)
    MAX_BYTES = 5 * 1024 * 1024

    # Revisar el tipo MIME que dice el navegador/cliente
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG, PNG o WEBP")

    # Revisar la extensión del nombre original
    original_ext = os.path.splitext(file.filename)[1].lower()
    if original_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Extensión no permitida (usa .jpg, .jpeg, .png, .webp)")

    # Revisar tamaño leyendo el contenido en memoria y luego regresando el puntero
    contents = file.file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 5MB)")
    
    # --- ARREGLO #1 (EL DEL "BODEGUERO") ---
    # Ya no necesitamos "regresar el puntero" (file.file.seek(0))
    # porque ahora guardaremos la variable 'contents'
    # file.file.seek(0) # <-- ESTA LÍNEA SE VA O SE COMENTA
    
    # ===== FIN VALIDACIÓN DE ARCHIVO =====

       # --- LÓGICA DE CARPETA Y NOMBRES POR PRODUCTO ---
    # Carpeta base para uploads
    base_upload_dir = "/code/uploads"
    os.makedirs(base_upload_dir, exist_ok=True)

    # 1) Sacamos el nombre del producto para armar carpeta y prefijo de archivo
    #    - Carpeta: MAYÚSCULAS con '_'
    #    - Archivo: minúsculas con '_'
    product_folder = _slugify(db_product.name, case="upper")  # p.ej. "CHIP_CLARO"
    file_prefix = _slugify(db_product.name, case="lower")     # p.ej. "chip_claro"

    # 2) Subcarpeta del producto
    product_dir = os.path.join(base_upload_dir, product_folder)
    os.makedirs(product_dir, exist_ok=True)

    # 3) Determinar el índice siguiente (chip_claro_1, chip_claro_2, ...)
    #    Buscamos archivos existentes que sigan el patrón 'chip_claro_<n>.<ext>'
    existing_files = [f for f in os.listdir(product_dir) if f.lower().startswith(f"{file_prefix}_")]
    max_index = 0
    pattern = re.compile(rf"^{re.escape(file_prefix)}_(\d+)\.", re.IGNORECASE)
    for fname in existing_files:
        m = pattern.match(fname)
        if m:
            try:
                idx = int(m.group(1))
                if idx > max_index:
                    max_index = idx
            except:
                pass
    next_index = max_index + 1

    # 4) Armar nombre final con extensión original (normalizada a lower)
    file_extension = os.path.splitext(file.filename)[1].lower()  # ej: '.jpg'
    safe_filename = f"{file_prefix}_{next_index}{file_extension}"  # ej: 'chip_claro_3.jpg'

    # 5) Ruta destino final
    file_path = os.path.join(product_dir, safe_filename)
    # --- FIN LÓGICA CARPETA/NOMBRE ---

    # --- INICIO DEL ARREGLO #1 (EL DEL "BODEGUERO") ---
    # En lugar de copiar el flujo del archivo (shutil.copyfileobj),
    # escribimos directamente la variable 'contents' que ya tiene los datos.
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    # --- FIN DEL ARREGLO ---

    # Nota: tu app sirve /uploads desde "/code/uploads" (app.mount en main.py)
    # Por lo tanto, devolvemos la URL relativa correcta con subcarpeta
    image_url = f"/uploads/{product_folder}/{safe_filename}"
    crud.add_product_image(db, product_id=product_id, image_url=image_url)

    db.refresh(db_product)
    return db_product

@app.delete("/product-images/{image_id}", response_model=schemas.ProductImage)
def delete_an_image(
    image_id: int,
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))
):
    db_image = crud.delete_product_image(db, image_id=image_id)
    if db_image is None:
        raise HTTPException(status_code=404, detail="Imagen no encontrada para eliminar")

    # --- BORRADO FÍSICO EN DISCO (SEGURO) ---
    try:
        # db_image.image_url viene como '/uploads/archivo.ext'
        # Construimos la ruta absoluta de forma segura
        relative_path = db_image.image_url.lstrip("/")  # 'uploads/archivo.ext'
        base_dir = "/code"                              # raíz del contenedor en runtime
        file_path = os.path.join(base_dir, relative_path)

        # Evitar path traversal: confirmar que está dentro de /code/uploads
        uploads_dir = os.path.join(base_dir, "uploads")
        if os.path.commonpath([os.path.abspath(file_path), uploads_dir]) == os.path.abspath(uploads_dir):
            if os.path.exists(file_path):
                os.remove(file_path)  # eliminamos el archivo
        # Si no existe, no pasa nada (quizá ya se borró manualmente)
    except Exception as e:
        # No rompemos la API si falla el borrado físico,
        # solo dejamos un comentario para log futuro.
        # (Si tienes logger, aquí iría un logger.warning(...))
        pass
    # --- FIN BORRADO FÍSICO ---

    return db_image



# ===================================================================
# --- ENDPOINTS PARA UBICACIONES ---
# ===================================================================
@app.post("/locations/", response_model=schemas.Location, status_code=status.HTTP_201_CREATED)
def create_new_location(location: schemas.LocationCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    return crud.create_location(db=db, location=location)

@app.get("/locations/", response_model=List[schemas.Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_locations(db, skip=skip, limit=limit)

@app.get("/locations/{location_id}", response_model=schemas.Location)
def read_location(location_id: int, db: Session = Depends(get_db)):
    db_location = crud.get_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return db_location

@app.put("/locations/{location_id}", response_model=schemas.Location)
def update_location_details(location_id: int, location: schemas.LocationCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    db_location = crud.update_location(db, location_id=location_id, location=location)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para actualizar")
    return db_location

@app.delete("/locations/{location_id}", response_model=schemas.Location)
def delete_location_by_id(location_id: int, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    db_location = crud.delete_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para eliminar")
    return db_location

# ===================================================================
# --- ENDPOINTS PARA STOCK ---
# ===================================================================
@app.post("/stock/", response_model=schemas.Stock, status_code=status.HTTP_201_CREATED)
def set_product_stock(stock: schemas.StockCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    return crud.set_stock(db=db, stock=stock)

@app.get("/locations/{location_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_location(location_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return crud.get_stock_by_location(db, location_id=location_id)

@app.get("/products/{product_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_product(product_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return crud.get_stock_by_product(db, product_id=product_id)

@app.post("/inventory/adjust", response_model=schemas.InventoryMovement)
def adjust_inventory_stock(
    adjustment: schemas.StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    # Verificamos PIN y Rol
    if not current_user.hashed_pin or not security.verify_password(adjustment.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    if current_user.role not in ["admin", "inventory_manager"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para ajustar el stock.")

    try:
        # 1. El "empleado" (crud.py) prepara el movimiento y actualiza el stock (en memoria)
        movement = crud.adjust_stock(db=db, adjustment=adjustment, user_id=current_user.id)
        
        # 2. Revisamos si el empleado nos devolvió algo
        if movement is None:
            # Si no devolvió nada, es porque la cantidad no cambió.
            # No hay nada que guardar, así que le decimos al usuario.
            db.rollback() # Deshacemos cualquier cambio en memoria
            raise HTTPException(status_code=400, detail="La cantidad especificada es la misma que la actual. No se realizó ningún ajuste.")

        # 3. ¡AQUÍ ESTÁ EL ARREGLO!
        # Si SÍ nos devolvió un movimiento, ahora la "recepcionista" (main.py)
        # guarda permanentemente los cambios en la base de datos.
        db.commit()
        
        # 4. Y le pedimos a la base de datos el "recibo" completo (con id, fecha, etc.)
        db.refresh(movement) 

        # 5. Ahora sí, devolvemos el movimiento completo y firmado.
        return movement
        
    except ValueError as e:
        # Si el "empleado" (crud) nos dijo que no había stock o algo salió mal...
        db.rollback() # Deshacemos los cambios
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Por si ocurre cualquier otro error (como el db.refresh(None) que tenías antes)
        db.rollback() # Deshacemos todo
        # Devolvemos un error 500 genérico pero registramos el detalle
        print(f"Error inesperado en adjust_inventory_stock: {e}")
        raise HTTPException(status_code=500, detail="Ocurrió un error interno al ajustar el stock.")

# ===================================================================
# --- ENDPOINTS PARA MOVIMIENTOS (KARDEX) ---
# ===================================================================
@app.post("/movements/", response_model=schemas.InventoryMovement, status_code=status.HTTP_201_CREATED)
def create_movement(movement: schemas.InventoryMovementCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    if not current_user.hashed_pin or not security.verify_password(movement.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    
    db_movement = crud.create_inventory_movement(db=db, movement=movement, user_id=current_user.id)
    if db_movement is None:
        raise HTTPException(status_code=400, detail="Stock insuficiente para realizar la operación.")
    return db_movement

@app.get("/products/{product_id}/movements/", response_model=List[schemas.InventoryMovement])
def read_movements_for_product(product_id: int, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.get_movements_by_product(db, product_id=product_id)

# ===================================================================
# --- ENDPOINTS PARA TURNOS (SHIFTS) ---
# ===================================================================
@app.post("/shifts/clock-in", response_model=schemas.Shift, status_code=status.HTTP_201_CREATED)
def clock_in_user(
    shift_in: schemas.ShiftClockIn,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    # Buscamos si el usuario tiene un turno activo
    existing_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    
    if existing_shift:
        # --- LÓGICA INTELIGENTE AÑADIDA ---
        # Si el turno es de un día anterior, lo cerramos automáticamente
        if existing_shift.start_time.date() < date.today():
            crud.clock_out(db, user_id=current_user.id)
        else:
            # Si es de hoy, entonces sí es un error
            raise HTTPException(status_code=400, detail="El usuario ya tiene un turno activo hoy.")
    
    # Procedemos a crear el nuevo turno para hoy
    return crud.clock_in(db=db, user_id=current_user.id, location_id=shift_in.location_id)

@app.post("/shifts/clock-out", response_model=schemas.Shift)
def clock_out_user(db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    shift = crud.clock_out(db=db, user_id=current_user.id)
    if not shift:
        raise HTTPException(status_code=404, detail="No se encontró un turno activo para cerrar.")
    return shift

# ===================================================================
# --- ENDPOINTS PARA VENTAS PERDIDAS ---
# ===================================================================
@app.post("/lost-sales/", response_model=schemas.LostSaleLog, status_code=status.HTTP_201_CREATED)
def create_new_lost_sale_log(log: schemas.LostSaleLogCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return crud.create_lost_sale_log(db=db, log=log, user_id=current_user.id)

@app.get("/lost-sales/", response_model=List[schemas.LostSaleLog])
def read_lost_sale_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.get_lost_sale_logs(db, skip=skip, limit=limit)

# ===================================================================
# --- ENDPOINTS PARA ÓRDENES DE TRABAJO ---
# ===================================================================
@app.post("/work-orders/", response_model=schemas.WorkOrderPublic, status_code=status.HTTP_201_CREATED)
def create_new_work_order(
    work_order: schemas.WorkOrderCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.hashed_pin or not security.verify_password(work_order.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")

    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if not active_shift:
        raise HTTPException(status_code=400, detail="El usuario debe tener un turno activo para crear una orden de trabajo.")

    return crud.create_work_order(db=db, work_order=work_order, user_id=current_user.id, location_id=active_shift.location_id)

@app.patch("/work-orders/{work_order_id}", response_model=schemas.WorkOrderPublic)
def update_work_order_status(
    work_order_id: int, 
    work_order_update: schemas.WorkOrderUpdate, 
    db: Session = Depends(get_db), 
    # Eliminamos el _role_check de aquí para que todos puedan actualizar
    current_user: models.User = Depends(security.get_current_user)
):
    updated_work_order = crud.update_work_order(db, work_order_id=work_order_id, work_order_update=work_order_update)
    if not updated_work_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    return updated_work_order

@app.get("/work-orders/", response_model=List[schemas.WorkOrderPublic])
def read_work_orders(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    # Quitamos el chequeo de rol y en su lugar pedimos el usuario actual.
    current_user: models.User = Depends(security.get_current_user)
):
    # Le pasamos el usuario actual a nuestra nueva función de CRUD.
    # Ella se encargará de decidir qué órdenes devolver.
    return crud.get_work_orders(db, user=current_user, skip=skip, limit=limit)


# --- NUEVO ENDPOINT PARA BUSCAR ÓRDENES LISTAS ---
@limiter.limit("60/minute")  # Búsqueda rápida pero con freno anti-abuso
@app.get("/work-orders/ready/search", response_model=List[schemas.WorkOrderPublic])
def search_ready_work_orders_endpoint(
    request: Request,
    search: str | None = None, # Parámetro de búsqueda
    skip: int = 0,
    limit: int = 20, # Limitamos a menos resultados para la búsqueda rápida
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Endpoint para buscar órdenes de trabajo en estado LISTO
    visibles para el usuario actual (según su turno y rol).
    Busca por ID, nombre de cliente o cédula.
    """
    return crud.search_ready_work_orders(db=db, user=current_user, search=search, skip=skip, limit=limit)
# --- FIN NUEVO ENDPOINT ---

@app.get("/work-orders/{work_order_id}", response_model=schemas.WorkOrderPublic)
def read_single_work_order(work_order_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if db_work_order is None:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    return db_work_order

@limiter.limit("10/minute")  # Subidas acotadas también aquí
@app.post("/work-orders/{work_order_id}/upload-image/", response_model=schemas.WorkOrderPublic)
def upload_work_order_image(
    request: Request,
    work_order_id: int,
    # ARREGLO: Le decimos a FastAPI que 'tag' NO viene por la URL,
    # sino que viene DENTRO del "paquete" (Form).
    tag: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    # Eliminamos el _role_check también de aquí
    current_user: models.User = Depends(security.get_current_user)
):
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if not db_work_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    
        # ===== VALIDACIÓN DE ARCHIVO (Orden de trabajo) =====
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    MAX_BYTES = 5 * 1024 * 1024

    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG, PNG o WEBP")

    original_ext = os.path.splitext(file.filename)[1].lower()
    if original_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Extensión no permitida (usa .jpg, .jpeg, .png, .webp)")

    contents = file.file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 5MB)")

    # --- ARREGLO #2 (EL DEL "BODEGUERO") ---
    # file.file.seek(0) # <-- ESTA LÍNEA SE VA O SE COMENTA
    # ===== FIN VALIDACIÓN DE ARCHIVO =====


        # --- LÓGICA DE CARPETA Y NOMBRES POR ORDEN ---
    base_upload_dir = "/code/uploads"
    os.makedirs(base_upload_dir, exist_ok=True)

    # 1) Nombre seguro para identificar la orden en carpeta/archivo
    #    preferimos el número visible (p.ej. "00004"); si no existe, usamos el id
    wo_number_raw = getattr(db_work_order, "work_order_number", None) or str(work_order_id)
    wo_number_slug_upper = _slugify(wo_number_raw, case="upper")  # para carpeta -> "00004" -> "00004"
    wo_number_slug_lower = _slugify(wo_number_raw, case="lower")  # para archivo -> "00004" -> "00004"

    # Carpeta: WORK_ORDER_<NUMERO>, p.ej. WORK_ORDER_00004
    order_folder = f"WORK_ORDER_{wo_number_slug_upper}"
    order_dir = os.path.join(base_upload_dir, order_folder)
    os.makedirs(order_dir, exist_ok=True)

    # Prefijo de archivo: work_order_<numero>
    file_prefix = f"work_order_{wo_number_slug_lower}"

    # 2) Calcular siguiente índice buscando archivos existentes 'work_order_<numero>_<n>.*'
    existing_files = [f for f in os.listdir(order_dir) if f.lower().startswith(f"{file_prefix}_")]
    max_index = 0
    pattern = re.compile(rf"^{re.escape(file_prefix)}_(\d+)\.", re.IGNORECASE)
    for fname in existing_files:
        m = pattern.match(fname)
        if m:
            try:
                idx = int(m.group(1))
                if idx > max_index:
                    max_index = idx
            except:
                pass
    next_index = max_index + 1

    # 3) Armar nombre final con extensión original normalizada a lower
    file_extension = os.path.splitext(file.filename)[1].lower()  # ej: '.jpg'
    safe_filename = f"{file_prefix}_{next_index}{file_extension}"  # ej: 'work_order_00004_3.jpg'

   # 4) Guardar archivo
    file_path = os.path.join(order_dir, safe_filename)
    
    # --- INICIO DEL ARREGLO #2 (EL DEL "BODEGUERO") ---
    # Aplicamos la misma corrección que en productos:
    # Escribimos la variable 'contents' que ya leímos durante la validación.
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    # --- FIN DEL ARREGLO ---

    # 5) Persistir en BD la URL pública (recuerda: app.mount("/uploads", ...))
    image_url = f"/uploads/{order_folder}/{safe_filename}"
    crud.add_work_order_image(db, work_order_id=work_order_id, image_url=image_url, tag=tag)

    db.refresh(db_work_order)
    return db_work_order
    # --- FIN LÓGICA DE CARPETA/NOMBRE POR ORDEN ---

    
# ===== Bitácora de órdenes (solo roles internos) =====

@app.post("/work-orders/{work_order_id}/notes", response_model=schemas.WorkOrderNote, status_code=status.HTTP_201_CREATED)
def add_work_order_note(
    work_order_id: int,
    note_in: schemas.WorkOrderNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
    _ok: None = Depends(security.require_internal_roles())
):
    # Verificar que la orden exista
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if not db_work_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    # Necesitamos saber en qué local está trabajando el usuario (turno activo)
    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if not active_shift:
        raise HTTPException(status_code=400, detail="Debes tener un turno activo para comentar.")

    # Crear la nota
    return crud.create_work_order_note(
        db=db,
        work_order_id=work_order_id,
        user_id=current_user.id,
        location_id=active_shift.location_id,
        message=note_in.message
    )

@app.get("/work-orders/{work_order_id}/notes", response_model=List[schemas.WorkOrderNote])
def list_work_order_notes(
    work_order_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _ok: None = Depends(security.require_internal_roles())
):
    # Verificar que la orden exista
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if not db_work_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    return crud.get_work_order_notes(db=db, work_order_id=work_order_id, skip=skip, limit=limit)

# ===== Fin bitácora =====


@app.get("/work-orders/{work_order_id}/print", response_class=StreamingResponse)
def print_work_order(
    work_order_id: int, 
    db: Session = Depends(get_db),
    _ok: None = Depends(security.require_internal_roles())
):
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if db_work_order is None:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    # --- ¡LA MAGIA SUCEDE AQUÍ! ---
    # 1. Convertimos el objeto de la base de datos a un esquema "inteligente" PRIMERO.
    schema_work_order = schemas.WorkOrder.model_validate(db_work_order)

    # 2. Ahora usamos 'schema_work_order' para TODO lo que sigue.
    pdf_buffer = pdf_utils.generate_work_order_pdf(schema_work_order)

    # 3. Creamos las cabeceras USANDO el objeto correcto.
    headers = {
        'Content-Disposition': f'inline; filename="orden_{schema_work_order.work_order_number}.pdf"'
    }

    # 4. Enviamos el PDF como una respuesta.
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)

# ===================================================================
# --- RUTAS INTERNAS (SOLO EMPLEADOS) - ÓRDENES COMPLETAS ---
# ===================================================================

# 1) Obtener UNA orden completa por ID
@app.get("/internal/work-orders/{work_order_id}", response_model=schemas.WorkOrder)
def read_work_order_internal(
    work_order_id: int,
    db: Session = Depends(get_db),
    _ok: None = Depends(security.require_internal_roles())  # <- SOLO empleados internos
):
    """
    Vista interna (taller): devuelve la orden COMPLETA con datos sensibles.
    """
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if db_work_order is None:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    return db_work_order


# 2) Listar órdenes completas (aplicando la lógica de tu CRUD)
@app.get("/internal/work-orders", response_model=List[schemas.WorkOrder])
def read_work_orders_internal(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
    _ok: None = Depends(security.require_internal_roles())  # <- SOLO empleados internos
):
    """
    Vista interna (taller): lista órdenes COMPLETAS.
    - Admin / inventory_manager: verán TODAS.
    - warehouse_operator: verá solo las de su sucursal actual (según su turno activo).
    """
    return crud.get_work_orders(db=db, user=current_user, skip=skip, limit=limit)



# 3) Buscar órdenes LISTAS (completas)
@app.get("/internal/work-orders/ready/search", response_model=List[schemas.WorkOrder])
def search_ready_work_orders_internal(
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
    _ok: None = Depends(security.require_internal_roles())  # <- SOLO empleados internos
):
    """
    Vista interna (taller): búsqueda de órdenes LISTAS (estado 'LISTO') con datos COMPLETOS.
    - Admin / inventory_manager: verán todas las LISTAS.
    - warehouse_operator: verá solo las LISTAS de su sucursal (según turno activo).
    """
    return crud.search_ready_work_orders(db=db, user=current_user, search=search, skip=skip, limit=limit)



# ===================================================================
# --- ENDPOINTS PARA PROVEEDORES ---
# ===================================================================
@app.post("/suppliers/", response_model=schemas.Supplier, status_code=status.HTTP_201_CREATED)
def create_new_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.create_supplier(db=db, supplier=supplier)

@app.get("/suppliers/", response_model=List[schemas.Supplier])
def read_suppliers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.get_suppliers(db, skip=skip, limit=limit)

@app.get("/suppliers/{supplier_id}", response_model=schemas.Supplier)
def read_single_supplier(supplier_id: int, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    db_supplier = crud.get_supplier(db, supplier_id=supplier_id)
    if db_supplier is None:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return db_supplier

@app.put("/suppliers/{supplier_id}", response_model=schemas.Supplier)
def update_supplier_details(supplier_id: int, supplier: schemas.SupplierCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    db_supplier = crud.update_supplier(db, supplier_id=supplier_id, supplier=supplier)
    if db_supplier is None:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado para actualizar")
    return db_supplier

@app.delete("/suppliers/{supplier_id}", response_model=schemas.Supplier)
def delete_supplier_by_id(supplier_id: int, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    db_supplier = crud.delete_supplier(db, supplier_id=supplier_id)
    if db_supplier is None:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado para eliminar")
    return db_supplier

# ===================================================================
# --- ENDPOINTS PARA FACTURAS DE COMPRA ---
# ===================================================================
@app.get("/purchase-invoices/", response_model=List[schemas.PurchaseInvoiceRead])
def read_purchase_invoices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))
):
    return crud.get_purchase_invoices(db=db, skip=skip, limit=limit)


@app.post("/purchase-invoices/", response_model=schemas.PurchaseInvoice, status_code=status.HTTP_201_CREATED)
def create_new_purchase_invoice(invoice: schemas.PurchaseInvoiceCreate, location_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    if not current_user.hashed_pin or not security.verify_password(invoice.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    if current_user.role not in ["admin", "inventory_manager"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para registrar compras.")
    
    try:
        return crud.create_purchase_invoice(db=db, invoice=invoice, user_id=current_user.id, location_id=location_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===================================================================
# --- ENDPOINTS PARA VENTAS ---
# ===================================================================
@app.post("/sales/", response_model=schemas.Sale, status_code=status.HTTP_201_CREATED)
def create_new_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    if not current_user.hashed_pin or not security.verify_password(sale.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if not active_shift:
        raise HTTPException(status_code=400, detail="El usuario debe tener un turno activo para crear una venta.")

    try:
        return crud.create_sale(db=db, sale=sale, user_id=current_user.id, location_id=active_shift.location_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # --- INICIO DE NUESTRO CÓDIGO ---
    # Esta es la nueva "manguera" (endpoint) que llamará el televisor
    except Exception as e:
        db.rollback()
        raise e


@app.get("/sales/", response_model=List[schemas.Sale])
def read_sales_history(
    # --- INICIO DE NUESTRO CÓDIGO ---
    # 1. Le decimos a la "manguera" que acepte estos filtros opcionales
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    # --- FIN DE NUESTRO CÓDIGO ---
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Obtiene una lista paginada del historial de ventas.
    Aplica filtros de permisos basados en el rol del usuario.
    """
    # 2. Pasamos los filtros que recibimos directo a la función del "archivador"
    sales_history = crud.get_sales(
        db, 
        user=current_user, 
        skip=skip, 
        limit=limit,
        # --- NUESTRAS NUEVAS LÍNEAS ---
        start_date=start_date,
        end_date=end_date,
        search=search
        # --- FIN NUESTRAS NUEVAS LÍNEAS ---
    )
    return sales_history
# --- FIN DE NUESTRO CÓDIGO ---


@app.get("/sales/{sale_id}/receipt", response_class=StreamingResponse)
def get_sale_receipt(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_sale = crud.get_sale(db, sale_id=sale_id)
    if db_sale is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    sale_schema = schemas.Sale.model_validate(db_sale)
    pdf_buffer = pdf_utils.generate_sale_receipt_pdf(sale_schema)
    headers = {
        "Content-Disposition": f'inline; filename="venta_{sale_schema.id}.pdf"'
    }

    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)

# ===================================================================
# --- ENDPOINTS PARA GESTIÓN DE CAJA (CUENTAS Y TRANSACCIONES) ---
# ===================================================================
@app.post("/cash-accounts/", response_model=schemas.CashAccount, status_code=status.HTTP_201_CREATED)
def create_new_cash_account(account: schemas.CashAccountCreate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin"]))):
    return crud.create_cash_account(db=db, account=account)

@app.get("/locations/{location_id}/cash-accounts/", response_model=List[schemas.CashAccount])
def read_cash_accounts_for_location(location_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return crud.get_cash_accounts_by_location(db, location_id=location_id)

@app.post("/cash-transactions/", response_model=schemas.CashTransaction, status_code=status.HTTP_201_CREATED)
def create_new_cash_transaction(transaction: schemas.CashTransactionCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    if not current_user.hashed_pin or not security.verify_password(transaction.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    
    db_transaction = crud.create_cash_transaction(db=db, transaction=transaction, user_id=current_user.id)
    if not db_transaction:
        raise HTTPException(status_code=404, detail="La cuenta de caja especificada no existe.")
    return db_transaction

@app.get("/cash-accounts/{account_id}/transactions/", response_model=List[schemas.CashTransaction])
def read_transactions_for_account(account_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.get_cash_transactions_by_account(db, account_id=account_id, skip=skip, limit=limit)

# ===================================================================
# --- ENDPOINTS PARA REPORTES  - DASHBOARDS - ETC ---
# ===================================================================
@app.get("/reports/top-sellers", response_model=List[schemas.TopSeller])
def get_top_sellers_report(start_date: date, end_date: date, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    top_sellers_data = crud.get_top_sellers(db, start_date=start_date, end_date=end_date)
    response = []
    for user, total_sales in top_sellers_data:
        response.append(schemas.TopSeller(user=user, total_sales=total_sales))
    return response

@app.get("/reports/dashboard-summary", response_model=schemas.DashboardSummary)
def get_dashboard_summary_report(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    # Obtenemos la ubicación del turno activo del usuario
    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if not active_shift:
        raise HTTPException(status_code=400, detail="El usuario debe tener un turno activo para ver el resumen.")
    
    today = date.today()
    summary = crud.get_dashboard_summary(db, location_id=active_shift.location_id, target_date=today)
    return summary

@app.get("/reports/inventory-audit", response_model=List[schemas.InventoryMovement])
def get_inventory_audit_report(
    start_date: date | None = None,
    end_date: date | None = None,
    user_id: int | None = None,
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"]))
):
    movements = crud.get_inventory_audit(db, start_date=start_date, end_date=end_date, user_id=user_id)
    return movements