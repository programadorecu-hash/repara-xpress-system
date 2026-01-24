import uuid # <--- NUEVO IMPORT
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint, DateTime, desc
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

# --- NUEVA TABLA MAESTRA: EMPRESAS (INQUILINOS DEL EDIFICIO) ---
class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # Ej: "Fix It", "ReparaXpress"
    plan_type = Column(String, default="FREE") # FREE, MONTHLY, ANNUAL
    is_active = Column(Boolean, default=True)
    
    # --- NUEVO: MARCA DE DISTRIBUIDOR (Para aparecer en el buscador público) ---
    is_distributor = Column(Boolean, default=False) 
    # --------------------------------------------------------------------------

    # --- NUEVO: Configuración de Módulos (JSON) ---
    modules = Column(JSON, nullable=True) 
    # ----------------------------------------------

    # --- NUEVO: CICLO DE FACTURACIÓN ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Fecha límite de pago. Si es NULL, es FREE de por vida o periodo de prueba indefinido.
    next_payment_due = Column(DateTime(timezone=True), nullable=True)
    
    # Fecha del último pago registrado
    last_payment_date = Column(DateTime(timezone=True), nullable=True)
    # -----------------------------------

    # Relaciones: Una empresa tiene muchos usuarios y configuraciones
    users = relationship("User", back_populates="company")
    settings = relationship("CompanySettings", back_populates="company", uselist=False) 
    # Relación inversa: Una empresa tiene muchos productos
    products = relationship("Product", back_populates="company")
    
    # --- NUEVO: Reseñas recibidas por la empresa ---
    reviews = relationship("CompanyReview", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    # --- INICIO DE NUESTRO CÓDIGO (Nuevos campos de RRHH) ---
    full_name = Column(String, nullable=True) # Nombre completo
    id_card = Column(String, nullable=True) # Cédula
    emergency_contact = Column(String, nullable=True) # Contacto de Emergencia
    # --- FIN DE NUESTRO CÓDIGO ---
    hashed_password = Column(String, nullable=False)
    hashed_pin = Column(String, nullable=True)
    # --- NUEVO: Código de recuperación de contraseña ---
    recovery_code = Column(String, nullable=True) 
    # --- NUEVO: Código de verificación de cuenta (Registro) ---
    verification_code = Column(String, nullable=True)
    # ---------------------------------------------------
    role = Column(String, nullable=False, default='viewer')
    is_active = Column(Boolean, default=True)

    # --- NUEVO: VINCULACIÓN CON LA EMPRESA ---
    # Cada usuario pertenece a una empresa específica.
    # nullable=True por ahora para no romper usuarios viejos, luego lo haremos obligatorio.
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")
    # -----------------------------------------

    movements = relationship("InventoryMovement", back_populates="user")
    shifts = relationship("Shift", back_populates="user")
    work_orders = relationship("WorkOrder", back_populates="user")
    sales = relationship("Sale", back_populates="user")
    lost_sale_logs = relationship("LostSaleLog", back_populates="user")
    cash_transactions = relationship("CashTransaction", back_populates="user")
    purchase_invoices = relationship("PurchaseInvoice", back_populates="user")
    # --- NUEVO: Relación con Gastos ---
    expenses = relationship("Expense", back_populates="user")
    
    # --- NUEVO: Reseñas escritas por este usuario ---
    reviews = relationship("CompanyReview", back_populates="user")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True) 
    email = Column(String, nullable=True)
    
    # --- NUEVO: Meta Diaria de Ventas ($) ---
    daily_goal = Column(Float, default=0.0)
    # ----------------------------------------

    parent_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    
    # --- RELACIÓN JERÁRQUICA (PADRE - HIJOS) ---
    # CORRECCIÓN: Definición explícita de ambos lados para evitar el error de backref
    # 1. Los hijos ven a su padre
    children = relationship("Location", back_populates="parent")
    
    # 2. El padre ve a sus hijos (remote_side=[id] es vital para relaciones recursivas)
    parent = relationship("Location", back_populates="children", remote_side=[id])
    # -------------------------------------------

    stock_entries = relationship("Stock", back_populates="location")
    movements = relationship("InventoryMovement", back_populates="location")
    shifts = relationship("Shift", back_populates="location")
    work_orders = relationship("WorkOrder", back_populates="location")
    sales = relationship("Sale", back_populates="location")
    lost_sale_logs = relationship("LostSaleLog", back_populates="location")
    cash_accounts = relationship("CashAccount", back_populates="location")
    # --- NUEVO: Relación con Gastos ---
    expenses = relationship("Expense", back_populates="location")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    
    # Vinculación con Empresa
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)

    # Datos principales (Identidad)
    sku = Column(String, index=True, nullable=False)
    name = Column(String, index=True, nullable=False) # Nombre Generado Automáticamente
    description = Column(String, nullable=True)
    
    # --- NUEVO: ADN DEL PRODUCTO (ATRIBUTOS ESTRUCTURADOS) ---
    product_type = Column(String, index=True, nullable=True) # Ej: PANTALLA, CABLE, MICA
    brand = Column(String, index=True, nullable=True)       # Ej: SAMSUNG
    model = Column(String, index=True, nullable=True)       # Ej: A32
    color = Column(String, nullable=True)                   # Ej: AZUL
    compatibility = Column(String, nullable=True)           # Ej: A52/A72
    condition = Column(String, nullable=True)               # Ej: NUEVO, SEMI-NUEVO
    # ---------------------------------------------------------

    price_1 = Column(Float)
    price_2 = Column(Float)
    price_3 = Column(Float)
    
    # Costos y Estado
    average_cost = Column(Float, default=0.0, nullable=False) 
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False) 
    
    # Relaciones (Foreign Keys)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)

    # Relaciones (ORM)
    category = relationship("Category", back_populates="products")
    stock_entries = relationship("Stock", back_populates="product")
    movements = relationship("InventoryMovement", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
    purchase_invoice_items = relationship("PurchaseInvoiceItem", back_populates="product")
    images = relationship("ProductImage", back_populates="product")
    supplier = relationship("Supplier", back_populates="products")
    company = relationship("Company", back_populates="products")

    # REGLA DE INTEGRIDAD: El SKU debe ser único DENTRO de cada empresa.
    __table_args__ = (UniqueConstraint('sku', 'company_id', name='_sku_company_uc'),)
class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, index=True, nullable=False) # Quitamos unique global
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
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

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
    physical_condition = Column(String, nullable=True)
    estimated_cost = Column(Float, nullable=False)
    deposit_amount = Column(Float, default=0, nullable=False)
    final_cost = Column(Float, nullable=True)

    # --- NUEVO: ID Público para compartir enlace ---
    public_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    # -----------------------------------------------

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

    # --- NUEVO: Firma Digital del Cliente ---
    # Guardaremos la URL o path de la imagen de la firma
    customer_signature = Column(String, nullable=True) 
    # ----------------------------------------
    
    # Relaciones (se añade la relación con las imágenes)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user = relationship("User", back_populates="work_orders")
    location = relationship("Location", back_populates="work_orders")
    sale = relationship("Sale", back_populates="work_order", uselist=False)
    
    # NUEVA RELACIÓN: Una orden de trabajo ahora puede tener muchas imágenes.
    images = relationship("WorkOrderImage", back_populates="work_order")
    expenses = relationship("Expense", back_populates="work_order")

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
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False)
    iva_percentage = Column(Float, nullable=False, default=12.0) # El IVA se define en el frontend (0 o 15) pero aquí necesita un default
    payment_method = Column(String, nullable=False)
    payment_method_details = Column(JSON, nullable=True)

    # --- NUEVO: ID Público para compartir enlace ---
    public_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    # -----------------------------------------------

    # --- NUEVAS COLUMNAS PARA DATOS DEL CLIENTE ---
    customer_ci = Column(String, index=True, nullable=False) # Cédula/RUC Obligatorio
    customer_name = Column(String, index=True, nullable=False) # Nombre Obligatorio
    customer_phone = Column(String, nullable=True) # Telefono es opcional
    customer_address = Column(String, nullable=True) # Direccion es opcional
    customer_email = Column(String, nullable=True) # Email es opcional
    # --- FIN NUEVAS COLUMNAS ---

    # --- NUEVO CAMPO: GARANTÍA ---
    warranty_terms = Column(String, nullable=True) # Texto libre para políticas de garantía
    # -----------------------------

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)
    user = relationship("User", back_populates="sales")
    
    location = relationship("Location", back_populates="sales")
    work_order = relationship("WorkOrder", back_populates="sale")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    
    # --- NUEVO: Costo Histórico (Cuánto costaba este ítem al momento de la venta) ---
    recorded_cost = Column(Float, default=0.0, nullable=False)
    # -------------------------------------------------------------------------------

    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)
    purchase_invoices = relationship("PurchaseInvoice", back_populates="supplier")
    # --- RELACIÓN INVERSA ---
    products = relationship("Product", back_populates="supplier")

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
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, index=True, nullable=False)
    
    account_type = Column(String, nullable=False)
    # AHORA ES OPCIONAL (nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    
    location = relationship("Location", back_populates="cash_accounts")
    transactions = relationship("CashTransaction", back_populates="account")
    expenses = relationship("Expense", back_populates="account")

    # Eliminamos UniqueConstraint explícito aquí porque lo manejamos con índices parciales en la migración

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


# --- Tabla de Reglas de Notificación ---
class NotificationRule(Base):
    __tablename__ = "notification_rules"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, nullable=False)
    event_type = Column(String, nullable=False) # "CLOCK_IN" o "SCHEDULED"
    message = Column(String, nullable=False)
    delay_seconds = Column(Integer, default=5)
    active = Column(Boolean, default=True)
    condition = Column(String, default="ALWAYS")
    # --- NUEVO: Lista de horas programadas (ej: ["13:00", "20:00"]) ---
    schedule_times = Column(JSON, nullable=True)
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Tabla de Clientes) ---
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    
    # Vinculación con Empresa
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)

    # Datos del Cliente
    id_card = Column(String, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    
    # Notas internas (ej: "Cliente conflictivo")
    notes = Column(String, nullable=True) 
    
    # Auditoría y Origen
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    
    # Relaciones
    location = relationship("Location")

    # REGLA DE INTEGRIDAD: La cédula debe ser única DENTRO de cada empresa.
    __table_args__ = (UniqueConstraint('id_card', 'company_id', name='_id_card_company_uc'),)

# --- INICIO DE NUESTRO CÓDIGO (Tabla Notas de Crédito) ---
class CreditNote(Base):
    __tablename__ = "credit_notes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # Código único (ej: NC-2025-001)
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=False)
    is_active = Column(Boolean, default=True) # True = Tiene saldo, False = Ya se usó
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True) # Opcional si es consumidor final
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Quién la emitió
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True) # Venta original (si aplica)
    
    customer = relationship("Customer")
    user = relationship("User")
    sale = relationship("Sale")
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Identidad de la Empresa) ---
class CompanySettings(Base):
    __tablename__ = "company_settings"
    id = Column(Integer, primary_key=True, index=True)

    # --- NUEVO: Pertenece a una empresa específica ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="settings")
    # -------------------------------------------------
    
    # Datos generales
    name = Column(String, default="Mi Empresa")
    ruc = Column(String, default="9999999999001")
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    
    # Logo (guardaremos la URL de la imagen)
    logo_url = Column(String, nullable=True)
    
    # Mensaje pie de página para recibos
    footer_message = Column(String, default="Gracias por su compra")

    # --- NUEVO: Configuración para WhatsApp ---
    whatsapp_country_code = Column(String, default="+593") # Código de país por defecto (ej: +593)
    
    # Mensaje para VENTAS (Recibos)
    whatsapp_default_message = Column(String, default="Hola, adjunto su documento.") 
    
    # Mensaje para ÓRDENES DE TRABAJO
    whatsapp_work_order_message = Column(String, default="Hola, actualizamos el estado de su equipo.")
    # ------------------------------------------

    # Configuración actualizada el:
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Módulo de Gastos) ---

class ExpenseCategory(Base):
    """
    Define los tipos de gastos (ej: Servicios Básicos, Nómina, Arriendo).
    """
    __tablename__ = "expense_categories"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    name = Column(String, index=True, nullable=False) # Quitamos unique global
    description = Column(String, nullable=True)
    
    # Relación: Una categoría tiene muchos gastos registrados
    expenses = relationship("Expense", back_populates="category")

class Expense(Base):
    """
    Registra cada gasto individual.
    """
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------
    
    # Detalles del dinero
    amount = Column(Float, nullable=False) # Cuánto costó
    description = Column(String, nullable=False) # Ej: "Factura Luz Enero 2026"
    expense_date = Column(DateTime(timezone=True), nullable=False) # Fecha del gasto (para el reporte)
    
    # Auditoría (Cuándo se registró en el sistema)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones (Enlaces)
    category_id = Column(Integer, ForeignKey("expense_categories.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # --- NUEVO: VINCULAR A UNA CUENTA DE CAJA Y ORDEN ---
    account_id = Column(Integer, ForeignKey("cash_accounts.id"), nullable=True) # De qué caja salió el dinero
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True) # Si es un gasto de una reparación (pasaje/repuesto)
    # ----------------------------------------------------

    category = relationship("ExpenseCategory", back_populates="expenses")
    location = relationship("Location", back_populates="expenses")
    user = relationship("User", back_populates="expenses")
    
    # Relaciones inversas nuevas
    account = relationship("CashAccount", back_populates="expenses")
    work_order = relationship("WorkOrder", back_populates="expenses")

# --- INICIO DE NUESTRO CÓDIGO (Módulo de Transferencias entre Sucursales) ---
# --- INICIO DE NUESTRO CÓDIGO (Módulo de Transferencias entre Sucursales) ---
class Transfer(Base):
    """
    Representa una 'Guía de Remisión' interna.
    Registra el movimiento de mercadería de una sucursal A a una sucursal B.
    """
    __tablename__ = "transfers"
    id = Column(Integer, primary_key=True, index=True)

    # --- PROPIEDAD: EMPRESA ---
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    # --------------------------

    # Origen y Destino
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)

    # Estado del envío: "PENDIENTE", "ACEPTADO", "RECHAZADO"
    status = Column(String, default="PENDIENTE", nullable=False)
    
    # Nota opcional (ej: "Envío urgente de pantallas")
    note = Column(String, nullable=True)

    # Auditoría (Quién y Cuándo)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now()) # Fecha de recepción/rechazo
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Quien envió
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Quien recibió (se llena al aceptar)

    # Relaciones
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
    
    items = relationship("TransferItem", back_populates="transfer")

    # --- PROPIEDADES MÁGICAS (TRADUCTORES PARA EL REPORTE) ---
    @property
    def source_location_name(self):
        return self.source_location.name if self.source_location else "Desconocido"

    @property
    def destination_location_name(self):
        return self.destination_location.name if self.destination_location else "Desconocido"

    @property
    def created_by_name(self):
        # Intentamos mostrar Nombre Completo, si no hay, mostramos Email
        if self.created_by:
            return self.created_by.full_name or self.created_by.email
        return "Sistema"

    @property
    def received_by_name(self):
        if self.received_by:
            return self.received_by.full_name or self.received_by.email
        return "Pendiente"
    # ---------------------------------------------------------

class TransferItem(Base):
    """
    Detalle de qué productos van en la transferencia.
    Ej: 5 Pantallas iPhone X
    """
    __tablename__ = "transfer_items"
    id = Column(Integer, primary_key=True, index=True)
    
    transfer_id = Column(Integer, ForeignKey("transfers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False) # Lo que se envió

    # --- NUEVO: Auditoría de Recepción ---
    received_quantity = Column(Integer, nullable=True) # Lo que realmente llegó
    reception_note = Column(String, nullable=True) # "Llegó roto", "Falta 1", etc.
    # -------------------------------------

    transfer = relationship("Transfer", back_populates="items")
    product = relationship("Product")

    # --- PROPIEDAD MÁGICA: NOMBRE DEL PRODUCTO ---
    @property
    def product_name(self):
        return self.product.name if self.product else f"Producto ID {self.product_id}"
    # ---------------------------------------------

# --- NUEVA TABLA: RESEÑAS DE EMPRESAS (MARKETPLACE) ---
class CompanyReview(Base):
    __tablename__ = "company_reviews"
    id = Column(Integer, primary_key=True, index=True)
    
    # Quién califica (Usuario registrado)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # A quién califica (Empresa/Distribuidor)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # La calificación (1 a 5 estrellas)
    rating = Column(Integer, nullable=False) 
    
    # El comentario
    comment = Column(String, nullable=False)
    
    # Cuándo se hizo
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    user = relationship("User", back_populates="reviews")
    company = relationship("Company", back_populates="reviews")
# ------------------------------------------------------


    # ... (código existente de otras clases)

# --- NUEVA TABLA: INVITACIONES PENDIENTES ---
class UserInvitation(Base):
    __tablename__ = "user_invitations"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False) # El rol que tendrá cuando acepte
    token = Column(String, unique=True, index=True, nullable=False) # El "ticket" secreto
    expires_at = Column(DateTime(timezone=True), nullable=False) # Cuándo caduca el ticket
    is_used = Column(Boolean, default=False)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
# ---------------------------------------------