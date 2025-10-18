from sqlalchemy.sql import func, and_
from sqlalchemy.orm import Session, joinedload
from datetime import date

from . import models, schemas, security

# ===================================================================
# --- CATEGORÍAS ---
# ===================================================================
def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).order_by(models.Category.name).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# ===================================================================
# --- PRODUCTOS ---
# ===================================================================
def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).order_by(models.Product.name).offset(skip).limit(limit).all()

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product: schemas.ProductCreate):
    db_product = get_product(db, product_id=product_id)
    if db_product:
        product_data = product.model_dump(exclude_unset=True)
        for key, value in product_data.items():
            setattr(db_product, key, value)
        db.commit()
        db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = get_product(db, product_id=product_id)
    if db_product:
        db.delete(db_product)
        db.commit()
    return db_product

# ===================================================================
# --- UBICACIONES ---
# ===================================================================
def get_location(db: Session, location_id: int):
    return db.query(models.Location).filter(models.Location.id == location_id).first()

def get_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Location).order_by(models.Location.id).offset(skip).limit(limit).all()

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

def update_location(db: Session, location_id: int, location: schemas.LocationCreate):
    db_location = get_location(db, location_id=location_id)
    if db_location:
        location_data = location.model_dump(exclude_unset=True)
        for key, value in location_data.items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
    return db_location

def delete_location(db: Session, location_id: int):
    db_location = get_location(db, location_id=location_id)
    if db_location:
        db.delete(db_location)
        db.commit()
    return db_location

def get_primary_bodega_for_location(db: Session, location_id: int):
    return db.query(models.Location).filter(models.Location.parent_id == location_id).first()

# ===================================================================
# --- STOCK ---
# ===================================================================
def get_stock_by_location(db: Session, location_id: int):
    return db.query(models.Stock).options(joinedload(models.Stock.product), joinedload(models.Stock.location)).filter(models.Stock.location_id == location_id).all()

def get_stock_by_product(db: Session, product_id: int):
    return db.query(models.Stock).options(joinedload(models.Stock.product), joinedload(models.Stock.location)).filter(models.Stock.product_id == product_id).all()

def set_stock(db: Session, stock: schemas.StockCreate):
    db_stock = db.query(models.Stock).filter(models.Stock.product_id == stock.product_id, models.Stock.location_id == stock.location_id).first()
    if db_stock:
        db_stock.quantity = stock.quantity
    else:
        db_stock = models.Stock(**stock.model_dump())
        db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

# ===================================================================
# --- MOVIMIENTOS (KARDEX) ---
# ===================================================================
def create_inventory_movement(db: Session, movement: schemas.InventoryMovementCreate, user_id: int):
    db_stock = db.query(models.Stock).filter(models.Stock.product_id == movement.product_id, models.Stock.location_id == movement.location_id).first()
    
    if movement.quantity_change < 0:
        if not db_stock or db_stock.quantity < abs(movement.quantity_change):
            raise ValueError("Stock insuficiente para realizar la operación.")
    
    if not db_stock:
        db_stock = models.Stock(product_id=movement.product_id, location_id=movement.location_id, quantity=0)
        db.add(db_stock)
        db.flush()
    
    db_stock.quantity += movement.quantity_change
    movement_data = movement.model_dump(exclude={"pin"})
    db_movement = models.InventoryMovement(**movement_data, user_id=user_id)
    db.add(db_movement)
    
    return db_movement

def get_movements_by_product(db: Session, product_id: int):
    return db.query(models.InventoryMovement).options(joinedload(models.InventoryMovement.product), joinedload(models.InventoryMovement.location), joinedload(models.InventoryMovement.user)).filter(models.InventoryMovement.product_id == product_id).order_by(models.InventoryMovement.timestamp.desc()).all()

# ===================================================================
# --- USUARIOS Y SEGURIDAD ---
# ===================================================================
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).order_by(models.User.id).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None

    if user_update.role and user_update.role != 'admin' and db_user.role == 'admin':
        admin_count = db.query(models.User).filter(models.User.role == 'admin').count()
        if admin_count <= 1:
            raise ValueError("No se puede eliminar al último administrador.")

    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
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

def reset_user_password(db: Session, user_id: int, new_password: str):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        hashed_password = security.get_password_hash(new_password)
        db_user.hashed_password = hashed_password
        db.commit()
        db.refresh(db_user)
    return db_user

# ===================================================================
# --- TURNOS ---
# ===================================================================
def get_active_shift_for_user(db: Session, user_id: int):
    return db.query(models.Shift).filter(models.Shift.user_id == user_id, models.Shift.end_time == None).first()

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

# ===================================================================
# --- VENTAS PERDIDAS ---
# ===================================================================
def create_lost_sale_log(db: Session, log: schemas.LostSaleLogCreate, user_id: int):
    db_log = models.LostSaleLog(**log.model_dump(), user_id=user_id)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_lost_sale_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.LostSaleLog).order_by(models.LostSaleLog.timestamp.desc()).offset(skip).limit(limit).all()

# ===================================================================
# --- ÓRDENES DE TRABAJO ---
# ===================================================================
def get_work_order(db: Session, work_order_id: int):
    return db.query(models.WorkOrder).options(joinedload(models.WorkOrder.user), joinedload(models.WorkOrder.location)).filter(models.WorkOrder.id == work_order_id).first()

def get_work_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.WorkOrder).options(joinedload(models.WorkOrder.user), joinedload(models.WorkOrder.location)).order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

def create_work_order(db: Session, work_order: schemas.WorkOrderCreate, user_id: int, location_id: int):
    work_order_data = work_order.model_dump(exclude={"pin"})
    db_work_order = models.WorkOrder(**work_order_data, user_id=user_id, location_id=location_id)
    db.add(db_work_order)
    db.commit()
    db.refresh(db_work_order)
    return db_work_order

def update_work_order(db: Session, work_order_id: int, work_order_update: schemas.WorkOrderUpdate):
    db_work_order = get_work_order(db, work_order_id=work_order_id)
    if db_work_order:
        update_data = work_order_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_work_order, key, value)
        db.commit()
        db.refresh(db_work_order)
    return db_work_order

# ===================================================================
# --- PROVEEDORES ---
# ===================================================================
def get_supplier(db: Session, supplier_id: int):
    return db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()

def get_suppliers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Supplier).order_by(models.Supplier.name).offset(skip).limit(limit).all()

def create_supplier(db: Session, supplier: schemas.SupplierCreate):
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

def update_supplier(db: Session, supplier_id: int, supplier: schemas.SupplierCreate):
    db_supplier = get_supplier(db, supplier_id=supplier_id)
    if db_supplier:
        update_data = supplier.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_supplier, key, value)
        db.commit()
        db.refresh(db_supplier)
    return db_supplier

def delete_supplier(db: Session, supplier_id: int):
    db_supplier = get_supplier(db, supplier_id=supplier_id)
    if db_supplier:
        db.delete(db_supplier)
        db.commit()
    return db_supplier
    
# ===================================================================
# --- FACTURAS DE COMPRA ---
# ===================================================================
def create_purchase_invoice(db: Session, invoice: schemas.PurchaseInvoiceCreate, user_id: int, location_id: int):
    try:
        total_cost = 0
        invoice_items_to_create = []
        for item in invoice.items:
            line_total = item.quantity * item.cost_per_unit
            total_cost += line_total
            invoice_items_to_create.append(models.PurchaseInvoiceItem(product_id=item.product_id, quantity=item.quantity, cost_per_unit=item.cost_per_unit))
        
        db_invoice = models.PurchaseInvoice(invoice_number=invoice.invoice_number, invoice_date=invoice.invoice_date, total_cost=total_cost, supplier_id=invoice.supplier_id, user_id=user_id, items=invoice_items_to_create)
        db.add(db_invoice)
        db.flush()

        for item in invoice.items:
            movement = schemas.InventoryMovementCreate(product_id=item.product_id, location_id=location_id, quantity_change=item.quantity, movement_type="ENTRADA_COMPRA", reference_id=f"COMPRA-{db_invoice.id}", pin=invoice.pin)
            create_inventory_movement(db=db, movement=movement, user_id=user_id)
        
        db.commit()
        db.refresh(db_invoice)
        return db_invoice
    except Exception as e:
        db.rollback()
        raise e

# ===================================================================
# --- VENTAS ---
# ===================================================================
def create_sale(db: Session, sale: schemas.SaleCreate, user_id: int, location_id: int):
    try:
        bodega = get_primary_bodega_for_location(db, location_id=location_id)
        if not bodega:
            raise ValueError(f"La sucursal con ID {location_id} no tiene una bodega configurada.")
        
        total_amount = 0
        sale_items_to_create = []
        for item in sale.items:
            line_total = item.quantity * item.unit_price
            total_amount += line_total
            sale_items_to_create.append(models.SaleItem(**item.model_dump(), line_total=line_total))

        db_sale = models.Sale(
            total_amount=total_amount,
            payment_method=sale.payment_method,
            payment_method_details=sale.payment_method_details,
            user_id=user_id,
            location_id=location_id,
            work_order_id=sale.work_order_id,
            items=sale_items_to_create
        )
        db.add(db_sale)
        db.flush()

        for item in sale.items:
            if item.product_id:
                movement = schemas.InventoryMovementCreate(
                    product_id=item.product_id,
                    location_id=bodega.id,
                    quantity_change=-item.quantity,
                    movement_type="VENTA",
                    reference_id=f"SALE-{db_sale.id}",
                    pin=sale.pin
                )
                create_inventory_movement(db=db, movement=movement, user_id=user_id)
        
        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            if db_work_order:
                db_work_order.status = "ENTREGADO"
                db_work_order.final_cost = total_amount
        
        db.commit()
        db.refresh(db_sale)
        return db_sale
    except ValueError as e:
        db.rollback()
        # Re-raise as a generic exception so the endpoint can handle it
        raise Exception(str(e))
    except Exception as e:
        db.rollback()
        raise e

# ===================================================================
# --- GESTIÓN DE CAJA ---
# ===================================================================
def create_cash_account(db: Session, account: schemas.CashAccountCreate):
    db_account = models.CashAccount(**account.model_dump())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def get_cash_accounts_by_location(db: Session, location_id: int):
    return db.query(models.CashAccount).filter(models.CashAccount.location_id == location_id).all()

def get_cash_account(db: Session, account_id: int):
    return db.query(models.CashAccount).filter(models.CashAccount.id == account_id).first()

def create_cash_transaction(db: Session, transaction: schemas.CashTransactionCreate, user_id: int):
    account = get_cash_account(db, account_id=transaction.account_id)
    if not account:
        return None
    db_transaction = models.CashTransaction(
        amount=transaction.amount,
        description=transaction.description,
        user_id=user_id,
        account_id=transaction.account_id
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def get_cash_transactions_by_account(db: Session, account_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.CashTransaction).options(
        joinedload(models.CashTransaction.user),
        joinedload(models.CashTransaction.account)
    ).filter(models.CashTransaction.account_id == account_id).order_by(models.CashTransaction.timestamp.desc()).offset(skip).limit(limit).all()

# ===================================================================
# --- REPORTES ---
# ===================================================================
def get_top_sellers(db: Session, start_date: date, end_date: date):
    return db.query(
        models.User,
        func.sum(models.Sale.total_amount).label("total_sales")
    ).join(models.Sale, models.User.id == models.Sale.user_id)\
    .filter(
        models.User.role == 'warehouse_operator',
        models.Sale.location_id != 1, # Excluye la Matriz
        and_(
            func.date(models.Sale.created_at) >= start_date,
            func.date(models.Sale.created_at) <= end_date
        )
    ).group_by(models.User.id).order_by(func.sum(models.Sale.total_amount).desc()).all()