# ME MUERO DE SUEÑO!!!! ES UN MARTES 3AM POR DEEEOOSSS!!! :(


from pydantic import BaseModel
from typing import List
from datetime import datetime

# --- Schemas Base ---
# (Estos no cambian)
class ProductBase(BaseModel):
    sku: str
    name: str
    description: str | None = None
    price_1: float
    price_2: float
    price_3: float
    is_active: bool = True

class LocationBase(BaseModel):
    name: str
    description: str | None = None
    parent_id: int | None = None

class StockBase(BaseModel):
    quantity: int

class InventoryMovementBase(BaseModel):
    quantity_change: int
    movement_type: str
    reference_id: str | None = None

class ShiftBase(BaseModel):
    pass

class UserBase(BaseModel):
    email: str
    role: str

# --- Schemas para Creación ---
# (Estos no cambian)
class ProductCreate(ProductBase):
    pass
class LocationCreate(LocationBase):
    pass
class StockCreate(StockBase):
    product_id: int
    location_id: int
class InventoryMovementCreate(InventoryMovementBase):
    product_id: int
    location_id: int
    pin: str
class ShiftClockIn(BaseModel):
    location_id: int
class ShiftCreate(ShiftBase):
    user_id: int
    location_id: int
class UserCreate(UserBase):
    password: str

# --- Schemas para Lectura (AQUÍ ESTÁ LA CORRECCIÓN) ---

class Product(ProductBase):
    id: int
    class Config:
        from_attributes = True

# --- ¡LA SOLUCIÓN! "VERSIONES MINI" PARA ROMPER LOS BUCLES ---
# Un schema de Usuario que NO incluye su lista de turnos, para usarlo DENTRO de otros schemas.
class UserSimple(UserBase):
    id: int
    class Config:
        from_attributes = True

# Un schema de Ubicación que NO incluye su lista de turnos.
class LocationSimple(LocationBase):
    id: int
    class Config:
        from_attributes = True

# --- SCHEMAS COMPLETOS (QUE USAN LAS VERSIONES MINI) ---
# Ahora los schemas que sí devuelven listas son seguros

class Shift(ShiftBase):
    id: int
    start_time: datetime
    end_time: datetime | None = None
    user: UserSimple         # <-- Usamos la versión simple para evitar el bucle
    location: LocationSimple # <-- Usamos la versión simple para evitar el bucle
    class Config:
        from_attributes = True

class Location(LocationSimple): # Heredamos de la versión simple
    shifts: List[Shift] = []    # Y le añadimos la lista de turnos

class User(UserSimple):         # Heredamos de la versión simple
    shifts: List[Shift] = []    # Y le añadimos la lista de turnos

class Stock(StockBase):
    id: int
    product: Product
    location: LocationSimple # Usamos la simple para seguridad
    class Config:
        from_attributes = True

class InventoryMovement(InventoryMovementBase):
    id: int
    timestamp: datetime
    product: Product
    location: LocationSimple # Usamos la simple
    user: UserSimple         # Usamos la simple
    class Config:
        from_attributes = True

# --- SCHEMA PIN
class UserSetPin(BaseModel):
    pin: str