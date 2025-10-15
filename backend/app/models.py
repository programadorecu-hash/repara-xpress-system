# EN backend/app/models.py

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint, DateTime
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

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String)
    parent_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    stock_entries = relationship("Stock", back_populates="location")
    movements = relationship("InventoryMovement", back_populates="location")
    shifts = relationship("Shift", back_populates="location")
    work_orders = relationship("WorkOrder", back_populates="location")
    sales = relationship("Sale", back_populates="location")
    lost_sale_logs = relationship("LostSaleLog", back_populates="location")

# --- CLASE NUEVA PARA CATEGORÍAS
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)

    products = relationship("Product", back_populates="category")
    
# --- CLASE PRODUCTO

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)
    description = Column(String)
    price_1 = Column(Float)
    price_2 = Column(Float)
    price_3 = Column(Float)
    is_active = Column(Boolean, default=True)
    stock_entries = relationship("Stock", back_populates="product")
    movements = relationship("InventoryMovement", back_populates="product")

    sale_items = relationship("SaleItem", back_populates="product")

    # --- AÑADIMOS LA CONEXIÓN A CATEGORÍA ---
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True) # Opcional por ahora
    category = relationship("Category", back_populates="products")
    # --- FIN DE LA MODIFICACIÓN ---


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
    status = Column(String, default="RECIBIDO")
    customer_name = Column(String, index=True, nullable=False)
    customer_id_card = Column(String, index=True, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_address = Column(String)
    device_type = Column(String, nullable=False)
    device_brand = Column(String, nullable=False)
    device_model = Column(String, nullable=False)
    device_serial = Column(String, nullable=True)
    device_password = Column(String, nullable=True)
    device_initial_state = Column(JSON)
    device_physical_state = Column(JSON)
    reported_issue = Column(String)
    estimated_cost = Column(Float, nullable=False)
    deposit_amount = Column(Float, default=0)
    final_cost = Column(Float, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user = relationship("User", back_populates="work_orders")
    location = relationship("Location", back_populates="work_orders")
    sale = relationship("Sale", back_populates="work_order", uselist=False)

class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)
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

    # --- CLASE NUEVA PARA PROVEEDORES ---
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)
    
    # Lo preparamos para el futuro Módulo de Compras
    # purchase_invoices = relationship("PurchaseInvoice", back_populates="supplier")