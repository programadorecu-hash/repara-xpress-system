from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from sqlalchemy.orm import Session
from datetime import date
from fastapi import File, UploadFile
import shutil
import os
import uuid

from . import models, schemas, crud, security
from .database import get_db

app = FastAPI(title="API de Inventarios de Repara Xpress")

app.mount("/uploads", StaticFiles(directory="/code/uploads"), name="uploads")

# --- MIDELWARE PARA CONECTAR EL FRONTEND ---
origins = [
    "http://localhost:5173", # La dirección de nuestro frontend de React
    "http://localhost",
    "http://localhost:8080", # Puedes añadir más si es necesario
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def create_new_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
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

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_products(db, skip=skip, limit=limit)

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

@app.post("/products/{product_id}/upload-image/", response_model=schemas.Product)
def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))
):
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # --- LÓGICA MEJORADA PARA NOMBRES ÚNICOS ---

    # Obtenemos la extensión del archivo original (ej: '.jpg')
    file_extension = os.path.splitext(file.filename)[1]

    # Creamos un nombre de archivo único usando un UUID
    unique_filename = f"{uuid.uuid4()}{file_extension}"

    upload_dir = "/code/uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # La nueva ruta con el nombre seguro
    file_path = os.path.join(upload_dir, unique_filename)

    # --- FIN DE LA LÓGICA MEJORADA ---

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image_url = f"/uploads/{unique_filename}"
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
    
    # Opcional: Aquí podríamos añadir la lógica para borrar el archivo del disco
    
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
        movement = crud.adjust_stock(db=db, adjustment=adjustment, user_id=current_user.id)
        # --- LA CORRECCIÓN ESTÁ AQUÍ ---
        if movement is None:
            # Si no hubo cambios, es una petición "mala" porque no hace nada.
            raise HTTPException(status_code=400, detail="La cantidad especificada es la misma que la actual. No se realizó ningún ajuste.")
        return movement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
@app.post("/work-orders/", response_model=schemas.WorkOrder, status_code=status.HTTP_201_CREATED)
def create_new_work_order(work_order: schemas.WorkOrderCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    if not current_user.hashed_pin or not security.verify_password(work_order.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    active_shift = crud.get_active_shift_for_user(db, user_id=current_user.id)
    if not active_shift:
        raise HTTPException(status_code=400, detail="El usuario debe tener un turno activo para crear una orden de trabajo.")
    return crud.create_work_order(db=db, work_order=work_order, user_id=current_user.id, location_id=active_shift.location_id)

@app.patch("/work-orders/{work_order_id}", response_model=schemas.WorkOrder)
def update_work_order_status(work_order_id: int, work_order_update: schemas.WorkOrderUpdate, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager", "warehouse_operator"]))):
    updated_work_order = crud.update_work_order(db, work_order_id=work_order_id, work_order_update=work_order_update)
    if not updated_work_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    return updated_work_order

@app.get("/work-orders/", response_model=List[schemas.WorkOrder])
def read_work_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))):
    return crud.get_work_orders(db, skip=skip, limit=limit)

@app.get("/work-orders/{work_order_id}", response_model=schemas.WorkOrder)
def read_single_work_order(work_order_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    db_work_order = crud.get_work_order(db, work_order_id=work_order_id)
    if db_work_order is None:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")
    return db_work_order

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