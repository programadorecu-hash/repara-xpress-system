

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from sqlalchemy.orm import Session

from . import models, schemas, crud, security

from .database import SessionLocal, engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="API de Inventarios de Repara Xpress")



# --- ENDPOINTS PARA USUARIOS Y AUTENTICACIÓN ---

@app.post("/users/", response_model=schemas.User)
def create_new_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    return crud.create_user(db=db, user=user)

# --- ESTE ENDPOINT DENTRO DE LA SECCIÓN DE USUARIOS ES PAR EL PIN DE AUTORIZACIÓN---
@app.post("/users/me/set-pin", response_model=schemas.User)
def set_current_user_pin(
    pin_data: schemas.UserSetPin,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    return crud.set_user_pin(db=db, user_id=current_user.id, pin=pin_data.pin)



# --- TOKEN LOGIN
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Buscamos al usuario por su email (que viene en el campo 'username' del formulario)
    user = crud.get_user_by_email(db, email=form_data.username)

    # 2. Si no existe, o si la contraseña es incorrecta, damos un error
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Si todo es correcto, creamos el "carnet de acceso" (token)
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    
    # 4. Devolvemos el token
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def read_root():
    return {"message": "¡Bienvenido a la API de Repara Xpress Quito!"}

# --- NUEVO ENDPOINT CREAR PRODUCTOS (VERSIÓN PROTEGIDA) ---
@app.post("/products/", response_model=schemas.Product)
def create_new_product(
    product: schemas.ProductCreate, 
    db: Session = Depends(get_db), 
    current_user: schemas.User = Depends(security.get_current_user) # <-- AÑADE ESTO
):
    # Ahora que tenemos al usuario, podríamos registrar quién creó el producto en el futuro.
    # Por ahora, solo con tener esta línea, el endpoint ya está protegido.
    return crud.create_product(db=db, product=product)

# --- NUEVO ENDPOINT PARA LEER PRODUCTOS ---
@app.get("/products/", response_model=List[schemas.Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    products = crud.get_products(db, skip=skip, limit=limit)
    return products

# --- NUEVO ENDPOINT PARA LEER UN SOLO PRODUCTO   ---
@app.get("/products/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db_product

# --- NUEVO ENDPOINT PARA ACTUALIZAR UN PRODUCTO ---
@app.put("/products/{product_id}", response_model=schemas.Product)
def update_product_details(product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = crud.update_product(db, product_id=product_id, product=product)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para actualizar")
    return db_product

# --- ENDPOINT PARA ELIMINAR PRODUCTO ---
@app.delete("/products/{product_id}", response_model=schemas.Product)
def delete_product_by_id(
    product_id: int, 
    db: Session = Depends(get_db),
    # AÑADIMOS EL VIGILANTE CON LA LISTA VIP
    _role_check: None = Depends(security.require_role(required_roles=["admin"]))
):
    db_product = crud.delete_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para eliminar")
    return db_product

# --- ENDPOINTS PARA UBICACIONES ---

@app.post("/locations/", response_model=schemas.Location)
def create_new_location(location: schemas.LocationCreate, db: Session = Depends(get_db)):
    return crud.create_location(db=db, location=location)

@app.get("/locations/", response_model=List[schemas.Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    locations = crud.get_locations(db, skip=skip, limit=limit)
    return locations

# --- ENDPOINT PARA BORRAR UBICACIONES ---
@app.delete("/locations/{location_id}", response_model=schemas.Location)
def delete_location_by_id(location_id: int, db: Session = Depends(get_db)):
    db_location = crud.delete_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para eliminar")
    return db_location

# --- ENDPOINT PARA LEER Y ACTUALIZAR UNA SOLA UBICACIÓN ---

@app.get("/locations/{location_id}", response_model=schemas.Location)
def read_location(location_id: int, db: Session = Depends(get_db)):
    db_location = crud.get_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return db_location

@app.put("/locations/{location_id}", response_model=schemas.Location)
def update_location_details(location_id: int, location: schemas.LocationCreate, db: Session = Depends(get_db)):
    db_location = crud.update_location(db, location_id=location_id, location=location)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para actualizar")
    return db_location

# --- ENDPOINTS PARA STOCK ---

@app.post("/stock/", response_model=schemas.Stock)
def set_product_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    return crud.set_stock(db=db, stock=stock)

# --- ENDPOINT QUE DEVUELVE EL ITEM CON ATRIBUTOS Y NO SOLO PROPIEDADES (NOMBRES Y NO SOLO ID´S)
@app.get("/locations/{location_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_location(location_id: int, db: Session = Depends(get_db)):
    stock = crud.get_stock_by_location(db, location_id=location_id)
    return stock

@app.get("/products/{product_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_product(product_id: int, db: Session = Depends(get_db)):
    stock = crud.get_stock_by_product(db, product_id=product_id)
    return stock

# --- ENDPOINTS PARA MOVIMIENTOS DE INVENTARIO (KARDEX) ---

@app.post("/movements/", response_model=schemas.InventoryMovement)
def create_movement(
    movement: schemas.InventoryMovementCreate, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    # Verificamos el PIN antes de hacer nada
    if not current_user.hashed_pin or not security.verify_password(movement.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    
    return crud.create_inventory_movement(db=db, movement=movement, user_id=current_user.id) # Pasaremos el user_id

# --- ENDPOINT PARA EL HISTORIAL DEL KARDEX
@app.get("/products/{product_id}/movements/", response_model=List[schemas.InventoryMovement])
def read_movements_for_product(product_id: int, db: Session = Depends(get_db)):
    movements = crud.get_movements_by_product(db, product_id=product_id)
    return movements

# --- ENDPOINTS PARA TURNOS (SHIFTS) ---

@app.post("/shifts/clock-in", response_model=schemas.Shift)
def clock_in_user(
    shift_in: schemas.ShiftClockIn,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    # Verificamos que el usuario no tenga ya un turno activo
    existing_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if existing_shift:
        raise HTTPException(status_code=400, detail="El usuario ya tiene un turno activo.")
    
    return crud.clock_in(db=db, user_id=current_user.id, location_id=shift_in.location_id)

@app.post("/shifts/clock-out", response_model=schemas.Shift)
def clock_out_user(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    shift = crud.clock_out(db=db, user_id=current_user.id)
    if not shift:
        raise HTTPException(status_code=404, detail="No se encontró un turno activo para cerrar.")
    return shift
