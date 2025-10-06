from sqlalchemy.sql import func
from sqlalchemy.orm import Session, joinedload
from . import models, schemas, security

# --- PRODUCTOS ---

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def update_product(db: Session, product_id: int, product: schemas.ProductCreate):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product:
        product_data = product.model_dump(exclude_unset=True)
        for key, value in product_data.items():
            setattr(db_product, key, value)
        db.commit()
        db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product

# --- UBICACIONES ---

def get_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Location).order_by(models.Location.id).offset(skip).limit(limit).all()

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

def delete_location(db: Session, location_id: int):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location:
        db.delete(db_location)
        db.commit()
    return db_location

def get_location(db: Session, location_id: int):
    return db.query(models.Location).filter(models.Location.id == location_id).first()

def update_location(db: Session, location_id: int, location: schemas.LocationCreate):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location:
        location_data = location.model_dump(exclude_unset=True)
        for key, value in location_data.items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
    return db_location

# --- STOCK ---

def set_stock(db: Session, stock: schemas.StockCreate):
    db_stock = db.query(models.Stock).filter(
        models.Stock.product_id == stock.product_id,
        models.Stock.location_id == stock.location_id
    ).first()
    if db_stock:
        db_stock.quantity = stock.quantity
    else:
        db_stock = models.Stock(**stock.model_dump())
        db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

def get_stock_by_location(db: Session, location_id: int):
    return db.query(models.Stock).options(
        joinedload(models.Stock.product),
        joinedload(models.Stock.location)
    ).filter(models.Stock.location_id == location_id).all()

def get_stock_by_product(db: Session, product_id: int):
    return db.query(models.Stock).options(
        joinedload(models.Stock.product),
        joinedload(models.Stock.location)
    ).filter(models.Stock.product_id == product_id).all()

# --- MOVIMIENTOS (KARDEX) ---

def create_inventory_movement(db: Session, movement: schemas.InventoryMovementCreate, user_id: int):
    db_stock = db.query(models.Stock).filter(
        models.Stock.product_id == movement.product_id,
        models.Stock.location_id == movement.location_id
    ).first()
    if not db_stock:
        initial_stock = schemas.StockCreate(
            product_id=movement.product_id,
            location_id=movement.location_id,
            quantity=0
        )
        db_stock = models.Stock(**initial_stock.model_dump())
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)
    
    db_stock.quantity += movement.quantity_change
    
    db_movement = models.InventoryMovement(
        product_id=movement.product_id,
        location_id=movement.location_id,
        quantity_change=movement.quantity_change,
        movement_type=movement.movement_type,
        reference_id=movement.reference_id,
        user_id=user_id
    )
    db.add(db_movement)

    db.commit()
    db.refresh(db_movement)
    
    return db_movement

def get_movements_by_product(db: Session, product_id: int):
    return db.query(models.InventoryMovement).options(
        joinedload(models.InventoryMovement.product),
        joinedload(models.InventoryMovement.location),
        joinedload(models.InventoryMovement.user) # ¡Añadamos al usuario a la respuesta!
    ).filter(models.InventoryMovement.product_id == product_id).order_by(models.InventoryMovement.timestamp.desc()).all()

# --- USUARIOS Y SEGURIDAD ---

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def set_user_pin(db: Session, user_id: int, pin: str):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        hashed_pin = security.get_password_hash(pin)
        db_user.hashed_pin = hashed_pin
        db.commit()
        db.refresh(db_user)
    return db_user

# --- TURNOS ---

def get_active_shift_for_user(db: Session, user_id: int):
    return db.query(models.Shift).filter(
        models.Shift.user_id == user_id,
        models.Shift.end_time == None
    ).first()

def clock_in(db: Session, user_id: int, location_id: int):
    new_shift = models.Shift(user_id=user_id, location_id=location_id)
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return new_shift

def clock_out(db: Session, user_id: int):
    active_shift = get_active_shift_for_user(db, user_id=user_id)
    if active_shift:
        active_shift.end_time = func.now()
        db.commit()
        db.refresh(active_shift)
    return active_shift