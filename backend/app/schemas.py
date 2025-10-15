# ME MUERO DE SUEÑO!!!! ES UN MARTES 3AM POR DEEEOOSSS!!! :(


from pydantic import BaseModel, computed_field
from typing import List, Dict, Any
from datetime import datetime

# --- Schemas Base ---

# --- NUEVOS SCHEMAS PARA CATEGORÍAS ---
class CategoryBase(BaseModel):
    name: str
    description: str | None = None

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    class Config:
        from_attributes = True

# (Estos no cambian)
class ProductBase(BaseModel):
    sku: str
    name: str
    description: str | None = None
    price_1: float
    price_2: float
    price_3: float
    is_active: bool = True
    category_id: int | None = None

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

class LostSaleLogBase(BaseModel):
    product_name: str
    reason: str
    location_id: int
    
class WorkOrderBase(BaseModel):
    customer_name: str
    customer_id_card: str
    customer_phone: str
    customer_address: str | None = None
    device_type: str
    device_brand: str
    device_model: str
    device_serial: str | None = None
    device_password: str | None = None
    device_initial_state: Dict[str, Any] | None = None
    device_physical_state: Dict[str, Any] | None = None
    reported_issue: str
    estimated_cost: float
    deposit_amount: float = 0

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
class UserSetPin(BaseModel):
    pin: str
class LostSaleLogCreate(LostSaleLogBase):
    pass
class WorkOrderCreate(WorkOrderBase):
    pin: str
class WorkOrderUpdate(BaseModel):
    status: str | None = None
    final_cost: float | None = None

# --- Schemas para Lectura ---
class Product(ProductBase):
    id: int
    category: Category | None = None
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
    user: UserSimple
    location: LocationSimple
    class Config:
        from_attributes = True

class Location(LocationSimple):
    shifts: List[Shift] = []
    class Config:
        from_attributes = True

class User(UserSimple):
    shifts: List[Shift] = []
    class Config:
        from_attributes = True

class Stock(StockBase):
    id: int
    product: Product
    location: LocationSimple
    class Config:
        from_attributes = True

class InventoryMovement(InventoryMovementBase):
    id: int
    timestamp: datetime
    product: Product
    location: LocationSimple
    user: UserSimple
    class Config:
        from_attributes = True
        
class LostSaleLog(LostSaleLogBase):
    id: int
    timestamp: datetime
    user: UserSimple
    class Config:
        from_attributes = True
        
class WorkOrder(WorkOrderBase):
    id: int
    created_at: datetime
    status: str
    final_cost: float | None = None
    user: UserSimple
    location: LocationSimple

    @computed_field
    @property
    def work_order_number(self) -> str:
        # Formatea el 'id' para que tenga 5 dígitos, rellenando con ceros a la izquierda
        return f"{self.id:05d}"

    class Config:
        from_attributes = True

# --- Reconstrucción de Modelos ---
Location.model_rebuild()
User.model_rebuild()

# --- Schemas para Ventas ---

class SaleItemBase(BaseModel):
    product_id: int | None = None # Es opcional, puede ser un servicio
    description: str
    quantity: int
    unit_price: float

class SaleItemCreate(SaleItemBase):
    pass

class SaleBase(BaseModel):
    payment_method: str
    work_order_id: int | None = None
    items: List[SaleItemCreate]

class SaleCreate(SaleBase):
    pin: str # ¡Para la seguridad!

class SaleItem(SaleItemBase):
    id: int
    line_total: float
    
    class Config:
        from_attributes = True

class Sale(SaleBase):
    id: int
    created_at: datetime
    total_amount: float
    
    user: UserSimple
    location: LocationSimple
    items: List[SaleItem]

    class Config:
        from_attributes = True

# --- Schemas para Proveedores ---
class SupplierBase(BaseModel):
    name: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None

class SupplierCreate(SupplierBase):
    pass

class Supplier(SupplierBase):
    id: int

    class Config:
        from_attributes = True