from sqlalchemy.sql import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
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

def get_primary_bodega_for_location(db: Session, location_id: int):
    # Busca la primera sub-ubicación (bodega) que pertenezca a la ubicación principal
    return db.query(models.Location).filter(models.Location.parent_id == location_id).first()

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

    if movement.quantity_change < 0:
        if not db_stock or db_stock.quantity < abs(movement.quantity_change):
            raise HTTPException(status_code=400, detail="Stock insuficiente para realizar la operación.")
    
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
    
    movement_data = movement.model_dump(exclude={"pin"})
    db_movement = models.InventoryMovement(
        **movement_data,
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
        joinedload(models.InventoryMovement.user)
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

# --- VENTAS PERDIDAS ---

def create_lost_sale_log(db: Session, log: schemas.LostSaleLogCreate, user_id: int):
    db_log = models.LostSaleLog(
        **log.model_dump(),
        user_id=user_id
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_lost_sale_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.LostSaleLog).order_by(models.LostSaleLog.timestamp.desc()).offset(skip).limit(limit).all()

# --- ÓRDENES DE TRABAJO ---

def create_work_order(db: Session, work_order: schemas.WorkOrderCreate, user_id: int, location_id: int):
    work_order_data = work_order.model_dump(exclude={"pin"})
    db_work_order = models.WorkOrder(
        **work_order_data,
        user_id=user_id,
        location_id=location_id
    )
    db.add(db_work_order)
    db.commit()
    db.refresh(db_work_order)
    return db_work_order

def update_work_order(db: Session, work_order_id: int, work_order_update: schemas.WorkOrderUpdate):
    db_work_order = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id).first()
    if db_work_order:
        update_data = work_order_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_work_order, key, value)
        db.commit()
        db.refresh(db_work_order)
    return db_work_order

def get_work_order(db: Session, work_order_id: int):
    return db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    ).filter(models.WorkOrder.id == work_order_id).first()

def get_work_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    ).order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

# --- VENTAS ---

def create_sale(db: Session, sale: schemas.SaleCreate, user_id: int, location_id: int):
    # Paso 1: Encontrar la bodega de la sucursal actual
    bodega = get_primary_bodega_for_location(db, location_id=location_id)
    if not bodega:
        raise HTTPException(status_code=400, detail=f"La sucursal con ID {location_id} no tiene una bodega configurada.")

    # Paso 2: Calcular totales (sin cambios)
    total_amount = 0
    sale_items_to_create = []
    for item in sale.items:
        line_total = item.quantity * item.unit_price
        total_amount += line_total
        sale_items_to_create.append(models.SaleItem(**item.model_dump(), line_total=line_total))

    # Paso 3: Crear el registro principal de la venta (sin cambios)
    db_sale = models.Sale(
        total_amount=total_amount,
        payment_method=sale.payment_method,
        user_id=user_id,
        location_id=location_id, # La venta se registra en la sucursal
        work_order_id=sale.work_order_id,
        items=sale_items_to_create
    )
    db.add(db_sale)
    db.flush() # Usamos flush para obtener el ID de la venta antes de commit

    # Paso 4: Descontar stock y registrar movimientos en el Kardex (¡CON LA MEJORA!)
    for item in sale.items:
        if item.product_id:
            movement = schemas.InventoryMovementCreate(
                product_id=item.product_id,
                location_id=bodega.id, # <-- ¡LA MAGIA! Usamos el ID de la bodega
                quantity_change=-item.quantity,
                movement_type="VENTA",
                reference_id=f"SALE-{db_sale.id}",
                pin=sale.pin
            )
            # Llamamos a la función que ya valida si hay stock suficiente
            create_inventory_movement(db, movement=movement, user_id=user_id)
    
    # Paso 5: Actualizar la Orden de Trabajo (sin cambios)
    if sale.work_order_id:
        db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
        if db_work_order:
            db_work_order.status = "ENTREGADO"
            db_work_order.final_cost = total_amount

    # Paso 6: Guardar todo (sin cambios)
    db.commit()
    db.refresh(db_sale)
    return db_sale

# --- CATEGORÍAS DE PRODUCTOS ---

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).order_by(models.Category.name).offset(skip).limit(limit).all()

def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

# --- PROVEEDORES ---

def create_supplier(db: Session, supplier: schemas.SupplierCreate):
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

def get_suppliers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Supplier).order_by(models.Supplier.name).offset(skip).limit(limit).all()

def get_supplier(db: Session, supplier_id: int):
    return db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()

def update_supplier(db: Session, supplier_id: int, supplier: schemas.SupplierCreate):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if db_supplier:
        update_data = supplier.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_supplier, key, value)
        db.commit()
        db.refresh(db_supplier)
    return db_supplier

def delete_supplier(db: Session, supplier_id: int):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if db_supplier:
        db.delete(db_supplier)
        db.commit()
    return db_supplier
