from pydantic import BaseModel, computed_field, field_validator
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
    # Hacemos explícito que este campo es parte del formulario base
    average_cost: float = 0.0 
    is_active: bool = True
    category_id: int | None = None
    supplier_id: int | None = None # <--- NUEVO CAMPO
    
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
    address: str | None = None
    # --- NUEVOS CAMPOS ---
    phone: str | None = None
    email: str | None = None
    # ---------------------
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
    # --- INICIO DE NUESTRO CÓDIGO (Nuevos campos de RRHH) ---
    is_active: bool = True # Para que la lista muestre el estado
    full_name: str | None = None
    id_card: str | None = None
    emergency_contact: str | None = None
    # --- FIN DE NUESTRO CÓDIGO ---

class LostSaleLogBase(BaseModel):
    product_name: str
    reason: str
    location_id: int
    
class WorkOrderBase(BaseModel):
    customer_name: str
    customer_id_card: str
    customer_phone: str
    customer_address: Optional[str] = None
    customer_email: Optional[str] = None
    device_type: str
    device_brand: str
    device_model: str
    device_serial: Optional[str] = None
    reported_issue: str
    physical_condition: Optional[str] = None
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

# ===== Schemas para la bitácora de órdenes =====
class WorkOrderNoteBase(BaseModel):
    message: str

class WorkOrderNoteCreate(WorkOrderNoteBase):
    pass

class WorkOrderNote(WorkOrderNoteBase):
    id: int
    created_at: datetime
    user: "UserSimple"
    location: "LocationSimple"

    class Config:
        from_attributes = True
# ===== Fin schemas bitácora =====

# --- INICIO DE NUESTRO CÓDIGO (Schemas de Clientes) ---
class CustomerBase(BaseModel):
    id_card: str
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    created_at: datetime
    # Incluimos la info básica de la ubicación
    location: Optional["LocationSimple"] = None 
    class Config:
        from_attributes = True
# --- FIN DE NUESTRO CÓDIGO ---


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
    # --- CORRECCIÓN ERROR 500: Permitimos que sea Cualquier cosa (Any) para aceptar Listas o Dicts ---
    payment_method_details: Any | None = None
    # ------------------------------------------------------------------------------------------------
    work_order_id: int | None = None
    # Valor por defecto actualizado a 15.0
    iva_percentage: float = 15.0

    # --- NUEVOS CAMPOS PARA DATOS DEL CLIENTE ---
    customer_ci: str
    customer_name: str
    customer_phone: str | None = None
    customer_address: str | None = None
    customer_email: str | None = None
    # --- FIN NUEVOS CAMPOS ---

    # --- NUEVO CAMPO GARANTÍA ---
    warranty_terms: str | None = None
    # ----------------------------

    items: List["SaleItemCreate"]

    @field_validator("iva_percentage")
    @classmethod
    def validate_iva_percentage(cls, value: float) -> float:
        """
        Aceptamos solamente 0% (RIMPE) o 15% (tarifa general actual en Ecuador).
        Esto evita errores de cálculo y mantiene consistencia tributaria.
        """
        if value not in (0, 15):
            raise ValueError("El IVA debe ser 0% o 15%.")
        return value

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
    # --- INICIO DE NUESTRO CÓDIGO (Nuevos campos de RRHH) ---
    full_name: str | None = None
    id_card: str | None = None
    emergency_contact: str | None = None
    # --- FIN DE NUESTRO CÓDIGO ---
class UserPasswordReset(BaseModel):
    new_password: str
class LostSaleLogCreate(LostSaleLogBase):
    pass
class WorkOrderCreate(WorkOrderBase):
    pin: str
    # --- NUEVO: Método de pago del adelanto (si hay adelanto) ---
    deposit_payment_method: str = "EFECTIVO" # Por defecto efectivo
class WorkOrderUpdate(BaseModel):
    status: str | None = None
    final_cost: float | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    customer_email: str | None = None
    
    # --- HABILITAMOS LA EDICIÓN DE ESTOS CAMPOS ---
    estimated_cost: float | None = None
    reported_issue: str | None = None
    physical_condition: str | None = None # El nuevo campo
    
    # Datos de seguridad del equipo
    device_password: str | None = None
    device_unlock_pattern: str | None = None
    device_account: str | None = None
    device_account_password: str | None = None
    # ----------------------------------------------

# --- INICIO CAMBIO: Formulario para Entregar Sin Reparar ---
class WorkOrderDeliverUnrepaired(BaseModel):
    diagnostic_fee: float = 2.00 # Por defecto sugerimos $2
    reason: str | None = "Cliente retiró equipo sin reparar"
    pin: str # Firma de seguridad
# --- FIN CAMBIO ---
class SupplierCreate(SupplierBase):
    pass
class PurchaseInvoiceItemCreate(PurchaseInvoiceItemBase):
    pass
class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    pin: str
    target_location_id: int # <--- El usuario elige a qué Sucursal va la mercadería
class SaleItemCreate(SaleItemBase):
    pass
# --- INICIO CAMBIO PAGOS MIXTOS ---
class PaymentDetail(BaseModel):
    method: str      # "EFECTIVO", "TRANSFERENCIA", etc.
    amount: float
    reference: str | None = None

class SaleCreate(SaleBase):
    pin: str
    # Ahora aceptamos una lista de pagos. 
    # Hacemos payment_method opcional aquí porque lo calcularemos nosotros.
    payment_method: str = "MIXTO" 
    payments: List[PaymentDetail] 
# --- FIN CAMBIO PAGOS MIXTOS ---

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

# --- CORRECCIÓN: Definimos Supplier ANTES de Product ---
class Supplier(SupplierBase):
    id: int
    class Config:
        from_attributes = True

class Product(ProductBase):
    id: int
    category: Category | None = None
    supplier: Supplier | None = None 
    images: List[ProductImage] = []
    stock_quantity: Optional[int] = None
    other_locations_stock: List[StockLocationInfo] = []

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
    # --- INICIO DE NUESTRO CÓDIGO (Para el Guardia de PIN) ---
    # Necesitamos saber si el PIN está vacío (None) o no
    hashed_pin: str | None = None 
    # --- FIN DE NUESTRO CÓDIGO ---

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
    location: LocationSimple
    class Config:
        from_attributes = True

class WorkOrder(WorkOrderBase):
    id: int
    public_id: str | None = None # <--- NUEVO
    created_at: datetime
    status: str
    final_cost: float | None = None
    user: UserSimple
    location: LocationSimple
    images: List[WorkOrderImage] = []
        # Notas internas (solo para vistas internas)
    notes: List[WorkOrderNote] = []


    @computed_field
    @property
    def work_order_number(self) -> str:
        return f"{self.id:05d}"
    class Config:
        from_attributes = True

        # ===== Esquema público: no expone datos sensibles de la orden =====
class WorkOrderPublic(BaseModel):
    # --- Campos visibles ---
    id: int
    public_id: str | None = None # <--- NUEVO
    created_at: datetime
    status: str
    final_cost: float | None = None

    # Datos del cliente
    customer_name: str
    customer_id_card: str
    customer_phone: str
    customer_address: Optional[str] = None
    customer_email: Optional[str] = None

    # Datos del equipo
    device_type: str
    device_brand: str
    device_model: str
    device_serial: Optional[str] = None
    reported_issue: str
    
    # --- NUEVOS CAMPOS VISIBLES PARA EL TÉCNICO ---
    physical_condition: Optional[str] = None 
    device_password: Optional[str] = None
    device_unlock_pattern: Optional[str] = None
    device_account: Optional[str] = None
    device_account_password: Optional[str] = None
    device_initial_check: Optional[Dict[str, Any]] = None 
    customer_declined_check: Optional[bool] = False
    # ----------------------------------------------

    estimated_cost: float
    deposit_amount: float = 0

    # Relaciones
    user: UserSimple
    location: LocationSimple
    images: List[WorkOrderImage] = []

    @computed_field
    @property
    def work_order_number(self) -> str:
        return f"{self.id:05d}"

    class Config:
        from_attributes = True
# ===== Fin esquema público =====


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

class PurchaseInvoiceRead(BaseModel):
    id: int
    invoice_number: str
    invoice_date: datetime
    total_cost: float
    created_at: datetime
    user: UserSimple
    supplier: Supplier
    items: List[PurchaseInvoiceItem]

    class Config:
        from_attributes = True

class SaleItem(SaleItemBase):
    id: int
    line_total: float
    # --- NUEVO ---
    recorded_cost: float = 0.0 # Mostramos el costo histórico en los reportes
    # -------------
    product: Product | None = None
    class Config:
        from_attributes = True
        
class Sale(SaleBase):
    id: int
    public_id: str | None = None # <--- NUEVO
    created_at: datetime
    subtotal_amount: float
    tax_amount: float
    total_amount: float

    # --- NUEVOS CAMPOS PARA DATOS DEL CLIENTE (RESPUESTA) ---
    customer_ci: str
    customer_name: str
    customer_phone: Optional[str] = None # <--- AÑADIDO 'Optional'
    customer_address: Optional[str] = None # <--- AÑADIDO 'Optional'
    customer_email: Optional[str] = None # <--- AÑADIDO 'Optional'
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

# --- INICIO DE NUESTRO CÓDIGO (Cierre de Caja) ---
class CashAccountBalance(BaseModel):
    """Un formulario simple para devolver el saldo de una caja."""
    account_id: int
    account_name: str
    current_balance: float
# --- FIN DE NUESTRO CÓDIGO ---

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

# --- (Moldes para Alertas de Stock) ---
class LowStockItem(BaseModel):
    product_name: str
    sku: str
    quantity: int
    location_name: str
# --- FIN DE NUESTRO CÓDIGO ---

# ---  (Reporte de Personal) ---
class DailyAttendance(BaseModel):
    date: date
    user_id: int
    user_email: str
    user_name: str | None = None
    first_clock_in: datetime
    last_clock_out: datetime | None = None
    total_hours: float
    locations_visited: List[str]
# --- FIN DE NUESTRO CÓDIGO ---

class DashboardSummary(BaseModel):
    total_sales: float
    total_expenses: float
    work_order_summary: WorkOrderStatusSummary

# --- INICIO DE NUESTRO CÓDIGO (Schemas Notificaciones) ---
class NotificationRuleBase(BaseModel):
    name: str
    event_type: str
    message: str
    delay_seconds: int = 5
    active: bool = True
    condition: str = "ALWAYS"
    # --- NUEVO: Campo opcional para las horas ---
    schedule_times: List[str] | None = None

class NotificationRuleCreate(NotificationRuleBase):
    pass

class NotificationRule(NotificationRuleBase):
    id: int
    class Config:
        from_attributes = True
# --- FIN DE NUESTRO CÓDIGO ---

    # --- (ASISTENTE DE CONFIGURACIÓN) ---
class FirstAdminCreate(BaseModel):
    # Este es el "formulario" especial que usará la página de configuración
    email: str
    password: str
    pin: str # Pedimos el email, la contraseña y el PIN de una vez
    # --- FIN DE NUESTRO CÓDIGO ---

    # --- INICIO DE NUESTRO CÓDIGO (Schemas Reembolsos) ---
# --- INICIO DE NUESTRO CÓDIGO (Schemas Reembolsos Mejorado) ---
class RefundCreate(BaseModel):
    sale_id: int
    amount: float
    reason: str
    type: str # "CASH" o "CREDIT_NOTE"
    pin: str 

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ('CASH', 'CREDIT_NOTE'):
            raise ValueError('El tipo debe ser CASH o CREDIT_NOTE')
        return v
# --- FIN DE NUESTRO CÓDIGO ---

class CreditNote(BaseModel):
    id: int
    code: str
    amount: float
    reason: str
    created_at: datetime
    class Config:
        from_attributes = True
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Schemas de Empresa) ---
class CompanySettingsBase(BaseModel):
    name: str
    ruc: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    footer_message: str | None = None
    # --- NUEVO: Campos para WhatsApp ---
    whatsapp_country_code: str | None = "+593"
    whatsapp_default_message: str | None = "Hola, adjunto su documento." # Ventas
    whatsapp_work_order_message: str | None = "Hola, actualizamos el estado de su equipo." # Órdenes
    # -----------------------------------

class CompanySettingsCreate(CompanySettingsBase):
    pass

class CompanySettings(CompanySettingsBase):
    id: int
    logo_url: str | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Schemas de Gastos) ---

# 1. Categorías de Gastos (Ej: Luz, Agua)
class ExpenseCategoryBase(BaseModel):
    name: str
    description: str | None = None

class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass

class ExpenseCategory(ExpenseCategoryBase):
    id: int
    class Config:
        from_attributes = True

# 2. Gastos (El registro del pago)
class ExpenseBase(BaseModel):
    amount: float
    description: str
    expense_date: datetime # Fecha contable del gasto
    category_id: int
    location_id: int
    # --- NUEVO ---
    account_id: int | None = None # Caja de origen
    work_order_id: int | None = None # Orden asociada
    # -------------

class ExpenseCreate(ExpenseBase):
    pin: str # Pedimos PIN para seguridad al registrar gastos

class Expense(ExpenseBase):
    id: int
    created_at: datetime
    user: UserSimple
    category: ExpenseCategory
    location: LocationSimple
    # account: CashAccountSimple | None = None # Opcional si quieres devolver info de la caja
    class Config:
        from_attributes = True

# ===================================================================
# --- SCHEMAS PARA REPORTES FINANCIEROS (UTILIDAD NETA) ---
# ===================================================================

class ExpenseBreakdown(BaseModel):
    category_name: str
    total_amount: float

class FinancialReport(BaseModel):
    start_date: date
    end_date: date
    
    # 1. Ingresos
    total_revenue: float      # Total de ventas (Subtotal sin impuestos)
    
    # 2. Costos Directos
    total_cogs: float         # Costo de los productos vendidos (Recorded Cost)
    
    # 3. Utilidad Bruta
    gross_profit: float       # Ingresos - Costos
    gross_margin_percent: float # Margen bruto %
    
    # 4. Gastos Operativos
    total_expenses: float     # Suma de facturas de luz, agua, etc.
    expenses_breakdown: List[ExpenseBreakdown] # Detalle por categoría
    
    # 5. Resultado Final
    net_utility: float        # Utilidad Bruta - Gastos
    net_margin_percent: float # Margen neto %
# --- FIN DE NUESTRO CÓDIGO ---

# ===================================================================
# --- RECONSTRUCCIÓN DE MODELOS ---
# ===================================================================
Location.model_rebuild()
User.model_rebuild()
PurchaseInvoiceBase.model_rebuild()
PurchaseInvoiceRead.model_rebuild()
SaleBase.model_rebuild()
WorkOrder.model_rebuild()

