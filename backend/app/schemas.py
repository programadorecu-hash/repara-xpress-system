from pydantic import BaseModel, computed_field
from typing import List, Dict, Any, Optional
from datetime import datetime, date

# ===================================================================
# --- SCHEMAS BASE ---
# ===================================================================
class CategoryBase(BaseModel):
    name: str
    description: str | None = None

class ProductBase(BaseModel):
    sku: str
    name: str
    description: str | None = None
    price_1: float
    price_2: float
    price_3: float
    is_active: bool = True
    category_id: int | None = None
    
class ProductImageBase(BaseModel):
    image_url: str

class ProductImageCreate(ProductImageBase):
    pass

class ProductImage(ProductImageBase):
    id: int
    product_id: int
    class Config:
        from_attributes = True

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
    customer_address: Optional[str] = None
    device_type: str
    device_brand: str
    device_model: str
    device_serial: Optional[str] = None
    reported_issue: str
    estimated_cost: float
    deposit_amount: float = 0
    
    # --- NUEVOS CAMPOS AÑADIDOS AL FORMULARIO BASE ---
    device_password: Optional[str] = None
    device_unlock_pattern: Optional[str] = None
    device_account: Optional[str] = None
    device_account_password: Optional[str] = None
    device_initial_check: Optional[Dict[str, Any]] = None # Aceptará un objeto JSON
    customer_declined_check: Optional[bool] = False

class WorkOrderImageBase(BaseModel):
    image_url: str
    tag: str

class WorkOrderImage(WorkOrderImageBase):
    id: int
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    
class PurchaseInvoiceItemBase(BaseModel):
    product_id: int
    quantity: int
    cost_per_unit: float
    
class PurchaseInvoiceBase(BaseModel):
    invoice_number: str
    invoice_date: date
    supplier_id: int
    items: List["PurchaseInvoiceItemCreate"]

class SaleItemBase(BaseModel):
    product_id: int | None = None
    description: str
    quantity: int
    unit_price: float
    
class SaleBase(BaseModel):
    payment_method: str
    payment_method_details: Dict[str, Any] | None = None
    work_order_id: int | None = None

    # --- NUEVOS CAMPOS PARA DATOS DEL CLIENTE ---
    customer_ci: str
    customer_name: str
    customer_phone: str | None = None
    customer_address: str | None = None
    customer_email: str | None = None
    # --- FIN NUEVOS CAMPOS ---

    items: List["SaleItemCreate"]

class CashAccountBase(BaseModel):
    name: str
    account_type: str
    location_id: int

class CashTransactionBase(BaseModel):
    amount: float
    description: str
    account_id: int

# ===================================================================
# --- SCHEMAS "SIMPLES" (PARA EVITAR BUCLES) ---
# ===================================================================
class UserSimple(UserBase):
    id: int
    class Config:
        from_attributes = True

class LocationSimple(LocationBase):
    id: int
    class Config:
        from_attributes = True

class CashAccountSimple(CashAccountBase):
    id: int
    class Config:
        from_attributes = True

# ===================================================================
# --- SCHEMAS PARA CREACIÓN ---
# ===================================================================
class CategoryCreate(CategoryBase):
    pass
class ProductCreate(ProductBase):
    pass
class LocationCreate(LocationBase):
    pass
class StockCreate(StockBase):
    product_id: int
    location_id: int
class StockAdjustmentCreate(BaseModel):
    product_id: int
    location_id: int # La bodega específica
    new_quantity: int
    reason: str
    pin: str
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
class UserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None
class UserPasswordReset(BaseModel):
    new_password: str
class LostSaleLogCreate(LostSaleLogBase):
    pass
class WorkOrderCreate(WorkOrderBase):
    pin: str
class WorkOrderUpdate(BaseModel):
    status: str | None = None
    final_cost: float | None = None
class SupplierCreate(SupplierBase):
    pass
class PurchaseInvoiceItemCreate(PurchaseInvoiceItemBase):
    pass
class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    pin: str
class SaleItemCreate(SaleItemBase):
    pass
class SaleCreate(SaleBase):
    pin: str
class CashAccountCreate(CashAccountBase):
    pass
class CashTransactionCreate(CashTransactionBase):
    pin: str

# ===================================================================
# --- SCHEMAS PARA LECTURA (RESPUESTAS DE LA API) ---
# ===================================================================
class Category(CategoryBase):
    id: int
    class Config:
        from_attributes = True

class StockLocationInfo(BaseModel):
    location_name: str
    quantity: int

class Product(ProductBase):
    id: int
    category: Category | None = None
    images: List[ProductImage] = []
    stock_quantity: Optional[int] = None
    other_locations_stock: List[StockLocationInfo] = []

    class Config:
        from_attributes = True

class Supplier(SupplierBase):
    id: int
    class Config:
        from_attributes = True

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

class UserProfile(User):
    active_shift: Shift | None = None

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
    images: List[WorkOrderImage] = []

    @computed_field
    @property
    def work_order_number(self) -> str:
        return f"{self.id:05d}"
    class Config:
        from_attributes = True

class PurchaseInvoiceItem(PurchaseInvoiceItemBase):
    id: int
    product: Product
    class Config:
        from_attributes = True

class PurchaseInvoice(PurchaseInvoiceBase):
    id: int
    created_at: datetime
    total_cost: float
    user: UserSimple
    supplier: Supplier
    items: List[PurchaseInvoiceItem]
    class Config:
        from_attributes = True

class SaleItem(SaleItemBase):
    id: int
    line_total: float
    product: Product | None = None
    class Config:
        from_attributes = True
        
class Sale(SaleBase):
    id: int
    created_at: datetime
    total_amount: float

    # --- NUEVOS CAMPOS PARA DATOS DEL CLIENTE (RESPUESTA) ---
    customer_ci: str
    customer_name: str
    customer_phone: str | None = None
    customer_address: str | None = None
    customer_email: str | None = None
    # --- FIN NUEVOS CAMPOS ---

    user: UserSimple
    location: LocationSimple
    items: List[SaleItem]
    class Config:
        from_attributes = True

class CashAccount(CashAccountBase):
    id: int
    location: LocationSimple
    class Config:
        from_attributes = True

class CashTransaction(CashTransactionBase):
    id: int
    timestamp: datetime
    user: UserSimple
    account: CashAccountSimple # <-- CORRECCIÓN FINAL
    class Config:
        from_attributes = True

class TopSeller(BaseModel):
    user: UserSimple
    total_sales: float

class WorkOrderStatusSummary(BaseModel):
    por_reparar: int
    en_espera: int
    reparando: int
    listo_para_entrega: int
    entregado: int
    sin_reparacion: int

class DashboardSummary(BaseModel):
    total_sales: float
    total_expenses: float
    work_order_summary: WorkOrderStatusSummary

# ===================================================================
# --- RECONSTRUCCIÓN DE MODELOS ---
# ===================================================================
Location.model_rebuild()
User.model_rebuild()
PurchaseInvoiceBase.model_rebuild()
SaleBase.model_rebuild()
WorkOrder.model_rebuild()

