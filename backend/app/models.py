from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint, DateTime
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .database import Base



class Product(Base):
    __tablename__ = "products" # Nombre de la tabla en la base de datos

    # Definimos las columnas de nuestra tabla
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)
    description = Column(String)
    price_1 = Column(Float) # Precio distribuidor
    price_2 = Column(Float) # Precio descuento
    price_3 = Column(Float) # Precio normal
    is_active = Column(Boolean, default=True)

    stock_entries = relationship("Stock", back_populates="product")

    # Añadimos la relación a los movimientos
    movements = relationship("InventoryMovement", back_populates="product") # <-- AÑADE ESTO

# --- CLASE LOCATION JAJAJA ME OLVIDÉ DE DOCUEMENTAR YA TENGO SUEÑO SON LAS 2AM :/
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String)
    
    # Esta es la magia para la jerarquía. Una ubicación puede tener una "ubicación padre".
    # Por ejemplo, el "Estante A" tiene como padre la "Bodega Principal".
    # Lo dejamos opcional (nullable=True).
    parent_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    stock_entries = relationship("Stock", back_populates="location")

    # Añadimos la relación a los movimientos
    movements = relationship("InventoryMovement", back_populates="location")

    shifts = relationship("Shift", back_populates="location")


# --- CLASE STOCK

class Stock(Base):
    __tablename__ = "stock"

    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer, nullable=False, default=0)

    # Creamos las "llaves foráneas" (Foreign Keys). Son los vínculos.
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)

    # Creamos las relaciones: desde una entrada de stock, podremos ver el producto y la ubicación.
    product = relationship("Product", back_populates="stock_entries")
    location = relationship("Location", back_populates="stock_entries")

    # Regla: La combinación de producto y ubicación debe ser única.
    __table_args__ = (UniqueConstraint('product_id', 'location_id', name='_product_location_uc'),)
    pass

# --- USER DB ESTO DEBO HASHEAR NO SE PUEDE QUEDAR ASÍ PERO POR AHORA AQUÍ VA EL MODELO
class User(Base): 
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    hashed_pin = Column(String, nullable=True)
    role = Column(String, nullable=False, default='viewer') # Ej: 'admin', 'inventory_manager', 'warehouse_operator'
    is_active = Column(Boolean, default=True)

    movements = relationship("InventoryMovement", back_populates="user")

    shifts = relationship("Shift", back_populates="user")

# --- CLASE NUEVA PARA EL KARDEX ---
class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(String, nullable=False) # Ej: 'ENTRADA_PROVEEDOR', 'VENTA', 'AJUSTE'
    reference_id = Column(String, nullable=True) # Para guardar ID de venta, orden de trabajo, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)#<--- USERID
    
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    
    product = relationship("Product", back_populates="movements")
    location = relationship("Location", back_populates="movements")

    user = relationship("User", back_populates="movements")#<--- RELACIÓN DE MOVIMIENTOS CON USUARIOS

# --- CLASE NUEVA PARA LOS TURNOS ---
class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True) # Se rellena al cerrar turno

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)

    user = relationship("User", back_populates="shifts")
    location = relationship("Location", back_populates="shifts")