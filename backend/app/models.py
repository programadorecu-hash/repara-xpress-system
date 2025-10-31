from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint, DateTime, desc
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    hashed_pin = Column(String, nullable=True)
    role = Column(String, nullable=False, default='viewer')
    is_active = Column(Boolean, default=True)
    movements = relationship("InventoryMovement", back_populates="user")
    shifts = relationship("Shift", back_populates="user")
    work_orders = relationship("WorkOrder", back_populates="user")
    sales = relationship("Sale", back_populates="user")
    lost_sale_logs = relationship("LostSaleLog", back_populates="user")
    cash_transactions = relationship("CashTransaction", back_populates="user")
    purchase_invoices = relationship("PurchaseInvoice", back_populates="user")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    stock_entries = relationship("Stock", back_populates="location")
    movements = relationship("InventoryMovement", back_populates="location")
    shifts = relationship("Shift", back_populates="location")
    work_orders = relationship("WorkOrder", back_populates="location")
    sales = relationship("Sale", back_populates="location")
    lost_sale_logs = relationship("LostSaleLog", back_populates="location")
    cash_accounts = relationship("CashAccount", back_populates="location")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    price_1 = Column(Float)
    price_2 = Column(Float)
    price_3 = Column(Float)
    is_active = Column(Boolean, default=True)
    # --- ESTA LINEA ES PARA UNA SOLA FOTO, LA DEJO AQUÍ POR SI LAS MOSCAS image_url = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    category = relationship("Category", back_populates="products")
    stock_entries = relationship("Stock", back_populates="product")
    movements = relationship("InventoryMovement", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
    purchase_invoice_items = relationship("PurchaseInvoiceItem", back_populates="product")

    images = relationship("ProductImage", back_populates="product")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    products = relationship("Product", back_populates="category")

class Stock(Base):
    __tablename__ = "stock"
    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    product = relationship("Product", back_populates="stock_entries")
    location = relationship("Location", back_populates="stock_entries")
    __table_args__ = (UniqueConstraint('product_id', 'location_id', name='_product_location_uc'),)

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(String, nullable=False)
    reference_id = Column(String, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product = relationship("Product", back_populates="movements")
    location = relationship("Location", back_populates="movements")
    user = relationship("User", back_populates="movements")

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user = relationship("User", back_populates="shifts")
    location = relationship("Location", back_populates="shifts")

class LostSaleLog(Base):
    __tablename__ = "lost_sale_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    product_name = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location = relationship("Location", back_populates="lost_sale_logs")
    user = relationship("User", back_populates="lost_sale_logs")

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="RECIBIDO", nullable=False)
    
    # Datos del Cliente (sin cambios)
    customer_name = Column(String, index=True, nullable=False)
    customer_id_card = Column(String, index=True, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_address = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    
    # Datos del Equipo (sin cambios)
    device_type = Column(String, nullable=False)
    device_brand = Column(String, nullable=False)
    device_model = Column(String, nullable=False)
    device_serial = Column(String, nullable=True)
    
    # Problema y Costos (sin cambios)
    reported_issue = Column(String, nullable=False)
    estimated_cost = Column(Float, nullable=False)
    deposit_amount = Column(Float, default=0, nullable=False)
    final_cost = Column(Float, nullable=True)

    # --- NUEVOS CAMPOS AÑADIDOS ---
    
    # 1. Campos para contraseñas y cuentas (opcionales)
    device_password = Column(String, nullable=True) # Para PIN o contraseña
    device_unlock_pattern = Column(String, nullable=True) # Para el patrón
    device_account = Column(String, nullable=True) # Para cuenta Google/iCloud
    device_account_password = Column(String, nullable=True) # Para la clave de la cuenta

    # 2. Checklist del estado inicial del equipo. Usamos JSON para guardar un objeto.
    device_initial_check = Column(JSON) # Ej: {"enciende": true, "camara": false, ...}
    
    # 3. Checkbox para indicar si el cliente no esperó la revisión.
    customer_declined_check = Column(Boolean, default=False, nullable=False)
    
    # Relaciones (se añade la relación con las imágenes)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user = relationship("User", back_populates="work_orders")
    location = relationship("Location", back_populates="work_orders")
    sale = relationship("Sale", back_populates="work_order", uselist=False)
    
    # NUEVA RELACIÓN: Una orden de trabajo ahora puede tener muchas imágenes.
    images = relationship("WorkOrderImage", back_populates="work_order")

        # Notas internas (bitácora)
    notes = relationship(
    "WorkOrderNote",
    back_populates="work_order",
    cascade="all, delete-orphan",
    order_by=lambda: desc(WorkOrderNote.created_at)
)



# ===== Bitácora interna por orden de trabajo =====
class WorkOrderNote(Base):
    __tablename__ = "work_order_notes"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    message = Column(String, nullable=False)

    # Relación con la orden
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    work_order = relationship("WorkOrder", back_populates="notes")

    # Quién escribió y desde qué local (ubicación del turno)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)

    user = relationship("User")       # (lectura sencilla; no necesitamos back_populates aquí)
    location = relationship("Location")
# ===== Fin bitácora =====


class WorkOrderImage(Base):
    __tablename__ = "work_order_images"
    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String, nullable=False)
    # NUEVO CAMPO: Para saber qué foto es (frontal, borde derecho, etc.)
    tag = Column(String, nullable=False) 
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    work_order = relationship("WorkOrder", back_populates="images")


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False)
    iva_percentage = Column(Float, nullable=False, default=12.0) # El IVA se define en el frontend (0 o 15) pero aquí necesita un default
    payment_method = Column(String, nullable=False)
    payment_method_details = Column(JSON, nullable=True)

    # --- NUEVAS COLUMNAS PARA DATOS DEL CLIENTE ---
    customer_ci = Column(String, index=True, nullable=False) # Cédula/RUC Obligatorio
    customer_name = Column(String, index=True, nullable=False) # Nombre Obligatorio
    customer_phone = Column(String, nullable=True) # Telefono es opcional
    customer_address = Column(String, nullable=True) # Direccion es opcional
    customer_email = Column(String, nullable=True) # Email es opcional
    # --- FIN NUEVAS COLUMNAS ---

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)
    user = relationship("User", back_populates="sales")
    
    location = relationship("Location", back_populates="sales")
    work_order = relationship("WorkOrder", back_populates="sale")
    items = relationship("SaleItem", back_populates="sale")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)
    purchase_invoices = relationship("PurchaseInvoice", back_populates="supplier")

class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, index=True, nullable=False)
    invoice_date = Column(DateTime(timezone=True), nullable=False)
    total_cost = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supplier = relationship("Supplier", back_populates="purchase_invoices")
    user = relationship("User", back_populates="purchase_invoices")
    items = relationship("PurchaseInvoiceItem", back_populates="invoice")

class PurchaseInvoiceItem(Base):
    __tablename__ = "purchase_invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer, nullable=False)
    cost_per_unit = Column(Float, nullable=False)
    invoice_id = Column(Integer, ForeignKey("purchase_invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    invoice = relationship("PurchaseInvoice", back_populates="items")
    product = relationship("Product", back_populates="purchase_invoice_items")

class CashAccount(Base):
    __tablename__ = "cash_accounts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    account_type = Column(String, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    location = relationship("Location", back_populates="cash_accounts")
    transactions = relationship("CashTransaction", back_populates="account")

class CashTransaction(Base):
    __tablename__ = "cash_transactions"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("cash_accounts.id"), nullable=False)
    user = relationship("User", back_populates="cash_transactions")
    account = relationship("CashAccount", back_populates="transactions")

class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    product = relationship("Product", back_populates="images")