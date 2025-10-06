from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from sqlalchemy.orm import Session

from . import models, schemas, crud, security
from .database import SessionLocal, engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="API de Inventarios de Repara Xpress")

# ===================================================================
# --- ENDPOINTS PARA USUARIOS Y AUTENTICACIÓN ---
# ===================================================================

@app.post("/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_new_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.post("/users/me/set-pin", response_model=schemas.User)
def set_current_user_pin(
    pin_data: schemas.UserSetPin,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    return crud.set_user_pin(db=db, user_id=current_user.id, pin=pin_data.pin)

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ===================================================================
# --- ENDPOINTS PARA PRODUCTOS ---
# ===================================================================

@app.post("/products/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_new_product(
    product: schemas.ProductCreate, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"])) # <-- PROTEGIDO
):
    return crud.create_product(db=db, product=product)

@app.get("/products/", response_model=List[schemas.Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    products = crud.get_products(db, skip=skip, limit=limit)
    return products

@app.get("/products/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return db_product

@app.put("/products/{product_id}", response_model=schemas.Product)
def update_product_details(
    product_id: int, 
    product: schemas.ProductCreate, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"])) # <-- PROTEGIDO
):
    db_product = crud.update_product(db, product_id=product_id, product=product)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para actualizar")
    return db_product

@app.delete("/products/{product_id}", response_model=schemas.Product)
def delete_product_by_id(
    product_id: int, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"])) # <-- PROTEGIDO
):
    db_product = crud.delete_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado para eliminar")
    return db_product

# ===================================================================
# --- ENDPOINTS PARA UBICACIONES ---
# ===================================================================

@app.post("/locations/", response_model=schemas.Location, status_code=status.HTTP_201_CREATED)
def create_new_location(
    location: schemas.LocationCreate, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"])) # <-- PROTEGIDO
):
    return crud.create_location(db=db, location=location)

@app.get("/locations/", response_model=List[schemas.Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    locations = crud.get_locations(db, skip=skip, limit=limit)
    return locations

@app.delete("/locations/{location_id}", response_model=schemas.Location)
def delete_location_by_id(
    location_id: int, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"])) # <-- PROTEGIDO
):
    db_location = crud.delete_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para eliminar")
    return db_location

@app.get("/locations/{location_id}", response_model=schemas.Location)
def read_location(location_id: int, db: Session = Depends(get_db)):
    db_location = crud.get_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return db_location

@app.put("/locations/{location_id}", response_model=schemas.Location)
def update_location_details(
    location_id: int, 
    location: schemas.LocationCreate, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"])) # <-- PROTEGIDO
):
    db_location = crud.update_location(db, location_id=location_id, location=location)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada para actualizar")
    return db_location

# ===================================================================
# --- ENDPOINTS PARA STOCK ---
# ===================================================================

@app.post("/stock/", response_model=schemas.Stock)
def set_product_stock(
    stock: schemas.StockCreate, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin"])) # <-- PROTEGIDO (Herramienta de Admin)
):
    return crud.set_stock(db=db, stock=stock)

@app.get("/locations/{location_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_location(location_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)): # <-- PROTEGIDO (Login Básico)
    stock = crud.get_stock_by_location(db, location_id=location_id)
    return stock

@app.get("/products/{product_id}/stock", response_model=List[schemas.Stock])
def read_stock_for_product(product_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)): # <-- PROTEGIDO (Login Básico)
    stock = crud.get_stock_by_product(db, product_id=product_id)
    return stock

# ===================================================================
# --- ENDPOINTS PARA MOVIMIENTOS (KARDEX) ---
# ===================================================================

@app.post("/movements/", response_model=schemas.InventoryMovement, status_code=status.HTTP_201_CREATED)
def create_movement(
    movement: schemas.InventoryMovementCreate, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
    if not current_user.hashed_pin or not security.verify_password(movement.pin, current_user.hashed_pin):
        raise HTTPException(status_code=403, detail="PIN incorrecto o no establecido")
    return crud.create_inventory_movement(db=db, movement=movement, user_id=current_user.id)

@app.get("/products/{product_id}/movements/", response_model=List[schemas.InventoryMovement])
def read_movements_for_product(
    product_id: int, 
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"])) # <-- PROTEGIDO
):
    movements = crud.get_movements_by_product(db, product_id=product_id)
    return movements

# ===================================================================
# --- ENDPOINTS PARA TURNOS (SHIFTS) ---
# ===================================================================

@app.post("/shifts/clock-in", response_model=schemas.Shift, status_code=status.HTTP_201_CREATED)
def clock_in_user(
    shift_in: schemas.ShiftClockIn,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_user)
):
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

# ===================================================================
# --- ENDPOINTS PARA VENTAS PERDIDAS ---
# ===================================================================

@app.post("/lost-sales/", response_model=schemas.LostSaleLog, status_code=status.HTTP_201_CREATED)
def create_new_lost_sale_log(
    log: schemas.LostSaleLogCreate,
    db: Session = Depends(get_db), # <-- CORREGIDO EL TIPO 'get_d b'
    current_user: schemas.User = Depends(security.get_current_user)
):
    return crud.create_lost_sale_log(db=db, log=log, user_id=current_user.id)

@app.get("/lost-sales/", response_model=List[schemas.LostSaleLog])
def read_lost_sale_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _role_check: None = Depends(security.require_role(required_roles=["admin", "inventory_manager"]))
):
    logs = crud.get_lost_sale_logs(db, skip=skip, limit=limit)
    return logs