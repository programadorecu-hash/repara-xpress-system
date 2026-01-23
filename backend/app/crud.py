
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.sql import func, and_, case, literal_column, or_, text, cast
from sqlalchemy import String # Importamos String para el cast
from sqlalchemy.orm import Session, joinedload, outerjoin, selectinload
from datetime import date, datetime # Añadimos datetime
import pytz # Añadimos pytz para la zona horaria
from decimal import Decimal
from app.utils.money import money, calc_tax, calc_total

import os
import shutil
import os
import random
import string

import smtplib # <--- El cartero
from email.mime.text import MIMEText # <--- El papel de la carta
from email.mime.multipart import MIMEMultipart # <--- El sobre
from datetime import timedelta # <--- Para calcular fecha de expiración

from . import models, schemas, security
from fastapi import HTTPException # <--- NUEVO: Para enviar mensajes de error claros

# --- HELPER DE CÁLCULO DE TOTALES (VENTA) ---
def _compute_sale_totals(items: list[dict], iva_percentage: float) -> tuple[float, float, float]:
    """
    Calcula los totales SIEMPRE desde cero.
    - items: lista de dicts con {quantity, unit_price}
    - iva_percentage: 0 o 15 (validado por schemas)
    Retorna (subtotal, tax_amount, total_amount) redondeados a 2 decimales.
    """
    subtotal = sum((item.get("quantity", 0) or 0) * (item.get("unit_price", 0) or 0) for item in items)
    subtotal = round(subtotal + 1e-9, 2)
    tax_amount = round(subtotal * (iva_percentage / 100.0), 2)
    total_amount = round(subtotal + tax_amount, 2)
    return subtotal, tax_amount, total_amount

# ===================================================================
# --- CATEGORÍAS ---
# ===================================================================
def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_categories(db: Session, company_id: int, skip: int = 0, limit: int = 100):
    # --- FILTRO MULTI-TENANCY: Solo categorías de mi empresa ---
    return db.query(models.Category).filter(models.Category.company_id == company_id).order_by(models.Category.name).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate, company_id: int):
    # --- ASIGNACIÓN: La categoría nace perteneciendo a la empresa ---
    db_category = models.Category(**category.model_dump(), company_id=company_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# ===================================================================
# --- PRODUCTOS ---
# ===================================================================
def get_product(db: Session, product_id: int):
    return db.query(models.Product).options(joinedload(models.Product.category), joinedload(models.Product.supplier), joinedload(models.Product.images)).filter(models.Product.id == product_id).first()

def get_products(db: Session, company_id: int, skip: int = 0, limit: int = 100, search: str | None = None, location_id: int | None = None):
    # --- Parte 1: Encontrar los productos que coinciden y su stock local ---
    base_query = db.query(
        models.Product,
        models.Category.name.label("category_name")
    ).outerjoin(models.Category, models.Product.category_id == models.Category.id)\
     .filter(models.Product.company_id == company_id)\
     .options(joinedload(models.Product.images), joinedload(models.Product.supplier)) # Cargar imágenes y proveedor
    current_bodega_id = None
    if location_id:
        # 1. Intentamos buscar la "Bodega Hija" (Sub-ubicación)
        bodega = get_primary_bodega_for_location(db, location_id=location_id)
        
        # 2. Si no hay hija, revisamos si la ubicación actual YA ES una bodega
        if not bodega:
            # Opción A: Es una bodega central o ubicación plana
            current_loc = get_location(db, location_id=location_id)
            if current_loc:
                bodega = current_loc

        if bodega:
            current_bodega_id = bodega.id
            # Añadir columna de stock local
            base_query = base_query.add_columns(
                func.coalesce(models.Stock.quantity, 0).label("stock_quantity")
            ).outerjoin(
                models.Stock,
                (models.Product.id == models.Stock.product_id) & (models.Stock.location_id == current_bodega_id)
            )
        else:
             # Si no encontramos NINGUNA ubicación válida para stock, mostramos 0
             base_query = base_query.add_columns(
                 literal_column("0").label("stock_quantity")
             )
    else:
         # Si no se especifica ubicación, añadir columna como 0
         base_query = base_query.add_columns(
             literal_column("0").label("stock_quantity")
         )


    # Aplicar filtro de búsqueda si existe
    if search:
        search_term = f"%{search.lower()}%"
        base_query = base_query.filter(
            or_(
                func.lower(models.Product.name).like(search_term),
                func.lower(models.Product.sku).like(search_term),
                func.lower(models.Product.product_type).like(search_term), # Buscar por Tipo (Pantalla, Cable...)
                func.lower(models.Product.brand).like(search_term), 
                func.lower(models.Product.model).like(search_term), 
                func.lower(models.Product.description).like(search_term)
            )
        )

    # Ejecutar la primera consulta para obtener los productos y stock local
    initial_results = base_query.order_by(models.Product.name).offset(skip).limit(limit).all()

    # Si no hay resultados, terminar aquí
    if not initial_results:
        return []

    # Extraer los IDs de los productos encontrados
    product_ids_found = [row.Product.id for row in initial_results]

    # --- Parte 2: Buscar stock en OTRAS bodegas para esos productos ---
    other_stock_data = defaultdict(list) # Usaremos un diccionario para agrupar
    if product_ids_found:
        # Encontrar IDs de todas las bodegas (excepto la actual si existe)
        other_bodegas_query = db.query(models.Location.id, models.Location.name).filter(models.Location.parent_id != None)
        if current_bodega_id:
            other_bodegas_query = other_bodegas_query.filter(models.Location.id != current_bodega_id)

        other_bodegas = other_bodegas_query.all()
        other_bodega_ids = [bodega.id for bodega in other_bodegas]
        other_bodega_names = {bodega.id: bodega.name for bodega in other_bodegas} # Mapa ID -> Nombre


        if other_bodega_ids:
            # Consultar stock en esas otras bodegas para los productos encontrados
            stock_in_others = db.query(
                models.Stock.product_id,
                models.Stock.location_id,
                models.Stock.quantity
            ).filter(
                models.Stock.product_id.in_(product_ids_found),
                models.Stock.location_id.in_(other_bodega_ids),
                models.Stock.quantity > 0 # Solo mostrar si hay stock
            ).all()

            # Agrupar los resultados por product_id
            for stock_entry in stock_in_others:
                location_name = other_bodega_names.get(stock_entry.location_id, "Desconocida")
                other_stock_data[stock_entry.product_id].append(
                    schemas.StockLocationInfo(
                        location_name=location_name,
                        quantity=stock_entry.quantity
                    )
                )

    # --- Parte 3: Combinar todo y devolver ---
    products_list = []
    for row in initial_results:
        product_data = row.Product.__dict__
        product_data['images'] = row.Product.images # Adjuntar imágenes
        product_data['category'] = schemas.Category(id=row.Product.category_id, name=row.category_name) if row.Product.category_id else None
        product_data['supplier'] = row.Product.supplier # Adjuntar proveedor

        # Añadir stock local (ya viene en 'row')
        product_data['stock_quantity'] = row.stock_quantity if row.stock_quantity is not None else 0

        # Añadir stock de otras ubicaciones (buscando en el diccionario que creamos)
        product_data['other_locations_stock'] = other_stock_data.get(row.Product.id, []) # Usa .get() para default a lista vacía

        # Validar con el schema Pydantic
        products_list.append(schemas.Product.model_validate(product_data))

    return products_list

def create_product(db: Session, product: schemas.ProductCreate, company_id: int):
    # 1. Validar Integridad: Verificar si el SKU ya existe en ESTA empresa
    existing_product = db.query(models.Product).filter(
        models.Product.sku == product.sku,
        models.Product.company_id == company_id
    ).first()
    
    if existing_product:
        # Si existe, detenemos todo y avisamos amablemente
        raise ValueError(f"El código SKU '{product.sku}' ya existe en su inventario.")

    # 2. Si no existe, creamos el producto vinculado a la empresa
    db_product = models.Product(**product.model_dump(), company_id=company_id)
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

def add_product_image(db: Session, product_id: int, image_url: str):
    db_image = models.ProductImage(product_id=product_id, image_url=image_url)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_product_image(db: Session, image_id: int):
    return db.query(models.ProductImage).filter(models.ProductImage.id == image_id).first()

def delete_product_image(db: Session, image_id: int):
    # Buscamos la imagen en la base de datos por su ID.
    db_image = get_product_image(db, image_id=image_id)
    
    # Si la encontramos...
    if db_image:
        # Guardamos la ruta del archivo ANTES de borrar el registro de la BD.
        image_path_to_delete = db_image.image_url

        # Borramos el registro de la base de datos.
        db.delete(db_image)
        db.commit()

        # --- ¡LA LÓGICA CLAVE! ---
        # Ahora, borramos el archivo físico del disco duro del servidor.
        # --- LÓGICA SEGURA CORREGIDA ---
        # Usamos os.path.join para evitar errores si falta el "/" inicial
        # .lstrip("/") quita la barra inicial si la tiene, para que join funcione bien
        full_file_path = os.path.join("/code", image_path_to_delete.lstrip("/"))
        
        try:
            if os.path.exists(full_file_path):
                os.remove(full_file_path)
                print(f"Archivo eliminado correctamente: {full_file_path}")
        except OSError as e:
            print(f"Advertencia: No se pudo borrar el archivo físico {full_file_path}: {e}")
        # -------------------------------
            
    return db_image


def add_work_order_image(db: Session, work_order_id: int, image_url: str, tag: str):
    """
    Añade una nueva imagen a una orden de trabajo existente.
    - work_order_id: El ID de la orden.
    - image_url: La ruta donde se guardó la imagen.
    - tag: La etiqueta que describe la foto (ej: "frontal", "borde_derecho").
    """
    db_image = models.WorkOrderImage(
        work_order_id=work_order_id, 
        image_url=image_url,
        tag=tag
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_work_order_image(db: Session, image_id: int):
    return db.query(models.WorkOrderImage).filter(models.WorkOrderImage.id == image_id).first()

def delete_work_order_image(db: Session, image_id: int):
    db_image = get_work_order_image(db, image_id)
    if db_image:
        db.delete(db_image)
        db.commit()
    return db_image

# ===================================================================
# --- UBICACIONES ---
# ===================================================================
def get_location(db: Session, location_id: int):
    return db.query(models.Location).filter(models.Location.id == location_id).first()

def get_locations(db: Session, company_id: int, skip: int = 0, limit: int = 100, include_all: bool = False):
    # --- INICIO DE NUESTRO CÓDIGO (Filtro Inteligente) ---
    # Por defecto (include_all=False), solo mostramos "Padres" (Sucursales) para menús limpios.
    # Si include_all=True, mostramos todo (para Transferencias y Logística).
    query = db.query(models.Location).filter(models.Location.company_id == company_id)
    
    if not include_all:
        query = query.filter(models.Location.parent_id == None)

    return query.order_by(models.Location.name).offset(skip).limit(limit).all()
    # --- FIN DE NUESTRO CÓDIGO ---

def create_location(db: Session, location: schemas.LocationCreate, company_id: int):
    # 1. Crear la Sucursal (Oficina)
    sucursal_data = location.model_dump()
    sucursal_data['parent_id'] = None 
    db_sucursal = models.Location(**sucursal_data, company_id=company_id)
    db.add(db_sucursal)
    db.flush() # Obtenemos el ID para usarlo abajo

    # 2. Crear la Bodega automática asociada
    db_bodega = models.Location(
        name=f"Bodega - {db_sucursal.name}", 
        description=f"Almacén en {db_sucursal.name}",
        address=db_sucursal.address, 
        parent_id=db_sucursal.id,
        company_id=company_id
    )
    db.add(db_bodega)
    
    # 3. Crear la Caja de Ventas automática
    db_caja_ventas = models.CashAccount(
        name=f"CAJA VENTAS - {db_sucursal.name.upper()}",
        account_type="CAJA_VENTAS", 
        location_id=db_sucursal.id,
        company_id=company_id
    )
    db.add(db_caja_ventas)

    # 4. Guardar todo
    db.commit()
    db.refresh(db_sucursal)
    return db_sucursal

def update_location(db: Session, location_id: int, location: schemas.LocationCreate):
    # --- INICIO DE NUESTRO CÓDIGO (Actualizar Sucursal y Bodega) ---
    
    # 1. Buscamos la "Oficina Principal" (Sucursal)
    db_location = get_location(db, location_id=location_id)
    if db_location:
        # Actualizamos los datos de la Oficina (Nombre, Descripción, Dirección)
        location_data = location.model_dump(exclude_unset=True)
        for key, value in location_data.items():
            setattr(db_location, key, value)
            
        # 2. Buscamos su "Cuarto de Almacenamiento" (Bodega)
        db_bodega = get_primary_bodega_for_location(db, location_id=db_location.id)
        if db_bodega:
            # Actualizamos también los datos de la Bodega para que coincidan
            db_bodega.name = f"Bodega - {db_location.name}"
            db_bodega.address = db_location.address
            
        # 3. Guardamos ambos cambios
        db.commit()
        db.refresh(db_location)
    return db_location
    # --- FIN DE NUESTRO CÓDIGO ---

def delete_location(db: Session, location_id: int):
    db_location = get_location(db, location_id=location_id)
    if db_location:
        db.delete(db_location)
        db.commit()
    return db_location

def get_primary_bodega_for_location(db: Session, location_id: int):
    """
    Busca la bodega asociada a una sucursal de forma inteligente.
    Prioridad 1: Un hijo con la palabra 'BODEGA' en su nombre.
    Prioridad 2: El primer hijo que encuentre.
    """
    children = db.query(models.Location).filter(models.Location.parent_id == location_id).all()
    
    # 1. Buscamos explícitamente al hijo que se llame 'Bodega'
    for child in children:
        if "BODEGA" in child.name.upper():
            return child
            
    # 2. Si no hay uno llamado Bodega, devolvemos el primero (comportamiento antiguo)
    if children:
        return children[0]
        
    return None

# --- INICIO DE NUESTRO CÓDIGO (Lista solo de Bodegas) ---
def get_bodegas(db: Session, company_id: int, skip: int = 0, limit: int = 100):
    """
    Devuelve una lista de las bodegas DE MI EMPRESA.
    """
    return db.query(models.Location)\
        .filter(models.Location.parent_id != None, models.Location.company_id == company_id)\
        .order_by(models.Location.name)\
        .offset(skip).limit(limit).all()
# --- FIN DE NUESTRO CÓDIGO ---

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

def adjust_stock(db: Session, adjustment: schemas.StockAdjustmentCreate, user_id: int):
    # Buscamos el stock actual
    db_stock = db.query(models.Stock).filter(
        models.Stock.product_id == adjustment.product_id,
        models.Stock.location_id == adjustment.location_id
    ).first()

    current_quantity = db_stock.quantity if db_stock else 0
    
    # Calculamos la diferencia que necesitamos mover
    quantity_change = adjustment.new_quantity - current_quantity

    # [CAMBIO] Permitimos confirmar el stock (diferencia 0) para que quede registro de auditoría
    # if quantity_change == 0:
    #    return None 

    # Creamos el movimiento en el Kardex
    movement = schemas.InventoryMovementCreate(
        product_id=adjustment.product_id,
        location_id=adjustment.location_id,
        quantity_change=quantity_change,
        movement_type="AJUSTE_CONTEO", # O podría ser "AJUSTE_INICIAL"
        reference_id=adjustment.reason,
        pin=adjustment.pin
    )
    # create_inventory_movement ya se encarga de la validación y de actualizar el stock
    return create_inventory_movement(db=db, movement=movement, user_id=user_id)

# ===================================================================
# --- MOVIMIENTOS (KARDEX) ---
# ===================================================================
def create_inventory_movement(db: Session, movement: schemas.InventoryMovementCreate, user_id: int):
    # Buscamos el stock actual del producto en la ubicación
    db_stock = db.query(models.Stock).filter(
        models.Stock.product_id == movement.product_id,
        models.Stock.location_id == movement.location_id
    ).with_for_update().first() # with_for_update() puede ayudar a prevenir condiciones de carrera

    # Verificamos si hay stock suficiente ANTES de hacer cambios
    if movement.quantity_change < 0: # Si estamos restando stock...
        current_quantity = db_stock.quantity if db_stock else 0
        if current_quantity < abs(movement.quantity_change):
            # Obtenemos el nombre del producto para el mensaje de error
            product = get_product(db, movement.product_id)
            product_name = product.name if product else f"ID {movement.product_id}"
            raise ValueError(f"Stock insuficiente para '{product_name}'. Disponible: {current_quantity}, Necesario: {abs(movement.quantity_change)}")

    # Si no hay registro de stock, creamos uno (asumiendo que es una entrada o ajuste inicial)
    if not db_stock:
        # [CAMBIO] Permitimos crear stock con 0 (inicialización vacía). Solo bloqueamos negativos.
        if movement.quantity_change < 0:
             product = get_product(db, movement.product_id)
             product_name = product.name if product else f"ID {movement.product_id}"
             raise ValueError(f"Intento de sacar stock inexistente para '{product_name}'.")
        db_stock = models.Stock(product_id=movement.product_id, location_id=movement.location_id, quantity=0)
        db.add(db_stock)
        # Necesitamos hacer flush aquí para que el db_stock obtenga un ID si es nuevo y
        # para asegurar que el lock with_for_update funcione correctamente si se crea
        db.flush()


    # Actualizamos la cantidad en el objeto Stock (en memoria de sesión)
    db_stock.quantity += movement.quantity_change

    # Creamos el registro del movimiento (en memoria de sesión)
    movement_data = movement.model_dump(exclude={"pin"}) # Excluimos el PIN
    db_movement = models.InventoryMovement(**movement_data, user_id=user_id)
    db.add(db_movement)

    # NO HACEMOS COMMIT AQUÍ - Dejamos que la función que llama (create_sale) lo haga al final

    return db_movement # Devolvemos el objeto movimiento (aún no guardado permanentemente)

def get_movements_by_product(db: Session, product_id: int):
    return db.query(models.InventoryMovement).options(joinedload(models.InventoryMovement.product), joinedload(models.InventoryMovement.location), joinedload(models.InventoryMovement.user)).filter(models.InventoryMovement.product_id == product_id).order_by(models.InventoryMovement.timestamp.desc()).all()

# --- NUEVO: MOTOR DE BÚSQUEDA GLOBAL (TRIVAGO DE REPUESTOS) ---
def search_global_parts(db: Session, query: str, limit: int = 50):
    """
    Busca repuestos en TODAS las empresas activas (ya no solo distribuidores).
    Basta con que el producto tenga is_public=True.
    """
    search_term = f"%{query.lower()}%"
    
    # Buscamos productos directamente en CUALQUIER empresa activa
    products = db.query(models.Product).join(models.Company).options(
        joinedload(models.Product.stock_entries), # Para ver si hay stock
        joinedload(models.Product.company).joinedload(models.Company.settings) # Para datos de contacto
    ).filter(
        models.Company.is_active == True, # <--- Único requisito: Que la empresa pague su mensualidad
        models.Product.is_active == True, # El producto debe existir
        models.Product.is_public == True, # <--- FILTRO VITAL: El técnico decidió hacerlo público
        # Búsqueda flexible en nombre, descripción, marca o modelo
        or_(
            func.lower(models.Product.name).like(search_term),
            func.lower(models.Product.description).like(search_term),
            func.lower(models.Product.sku).like(search_term),
            func.lower(models.Product.product_type).like(search_term),
            func.lower(models.Product.brand).like(search_term),
            func.lower(models.Product.model).like(search_term)
        )
    ).limit(limit).all()

    # 3. Formatear los resultados para el público
    results = []
    for p in products:
        # Calcular stock total (sumando todas sus bodegas)
        total_stock = sum(s.quantity for s in p.stock_entries)
        
        # Estado del stock (Semáforo)
        stock_status = "Agotado"
        if total_stock > 5: stock_status = "Disponible"
        elif total_stock > 0: stock_status = "Pocas Unidades"

        # Datos de contacto de la empresa
        company_settings = p.company.settings if p.company.settings else None
        
        # --- LÓGICA DE NOMBRE COMERCIAL ---
        # Priorizamos el nombre configurado en settings. 
        # Si no existe, usamos el nombre de registro (company.name) como fallback.
        display_name = company_settings.name if (company_settings and company_settings.name) else p.company.name
        # ----------------------------------

        phone = company_settings.phone if company_settings else None
        address = company_settings.address if company_settings else None

        results.append(schemas.PublicProductSearchResult(
            product_name=p.name,
            # REGLA DE ORO: En la web pública se muestra el PRECIO DISTRIBUIDOR (Price 1).
            # Si no tiene precio distribuidor (0), usamos el Price 3 (PVP) como fallback.
            price=p.price_1 if p.price_1 > 0 else p.price_3, 
            stock_status=stock_status,
            company_name=display_name, 
            company_address=address,
            company_phone=phone,
            last_updated=datetime.now() # Fecha referencia
        ))
    
    # Ordenar por precio (del más barato al más caro) para que sea útil
    results.sort(key=lambda x: x.price)
    
    return results
# --------------------------------------------------------------


# ===================================================================
# --- USUARIOS Y SEGURIDAD ---
# ===================================================================
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, company_id: int, skip: int = 0, limit: int = 100):
    # Solo mostrar empleados de mi empresa
    return db.query(models.User).filter(models.User.company_id == company_id).order_by(models.User.id).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate, company_id: int):
    # --- INICIO DE NUESTRO CÓDIGO (RRHH: Crear empleado/gerente) ---
    hashed_password = security.get_password_hash(user.password)
    
    # Preparamos al usuario y le asignamos la EMPRESA del jefe
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        is_active=True,
        company_id=company_id # <--- AQUÍ ESTÁ LA CLAVE
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
    # --- FIN DE NUESTRO CÓDIGO ---

    

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None

    if user_update.role and user_update.role != 'admin' and db_user.role == 'admin':
        admin_count = db.query(models.User).filter(models.User.role == 'admin').count()
        if admin_count <= 1:
            raise ValueError("No se puede eliminar al último administrador.")

    # --- INICIO DE NUESTRO CÓDIGO (RRHH: Editar empleado/gerente) ---
    # Le decimos que acepte los nuevos campos (full_name, id_card, etc.)
    # exclude_unset=True es CLAVE: solo actualiza los campos que el admin tocó.
    update_data = user_update.model_dump(exclude_unset=True)
    # --- FIN DE NUESTRO CÓDIGO ---

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
# --- SISTEMA DE INVITACIONES ---
# ===================================================================

def create_invitation(db: Session, invitation_data: schemas.InvitationCreate, admin_user: models.User):
    """
    1. Genera un token único.
    2. Guarda la invitación.
    3. Envía el correo al futuro empleado.
    """
    # Verificar si ya existe el usuario
    if get_user_by_email(db, invitation_data.email):
        raise ValueError("Este correo ya está registrado como usuario activo.")

    # Generar Token único (Ticket)
    token = str(uuid.uuid4())
    
    # Caduca en 48 horas
    expiration = datetime.now(pytz.utc) + timedelta(hours=48)

    db_invitation = models.UserInvitation(
        email=invitation_data.email,
        role=invitation_data.role,
        token=token,
        expires_at=expiration,
        company_id=admin_user.company_id,
        created_by_id=admin_user.id
    )
    db.add(db_invitation)
    db.flush()

    # --- ENVIAR CORREO ---
    try:
        # Configuración (Usa las mismas credenciales que ya pusimos en register)
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "programador.ecu@gmail.com" # <--- TU CORREO
        sender_password = "sjvg bgag xdkp zlaa"    # <--- TU CLAVE
        
        # Link de aceptación (Ajusta la URL base si es necesario)
        # Apunta al Frontend: http://localhost:5173/accept-invite?token=...
        invite_link = f"http://localhost:5173/accept-invite?token={token}"

        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = invitation_data.email
        msg['Subject'] = "Te han invitado a unirte a Repara Xpress"

        body = f"""
        Hola,
        
        {admin_user.email} te ha invitado a formar parte de su equipo en Repara Xpress.
        
        Para crear tu perfil, definir tu contraseña y comenzar, haz clic aquí:
        
        {invite_link}
        
        Este enlace caduca en 48 horas.
        """
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, invitation_data.email, msg.as_string())
        server.quit()
        
        print(f"✅ Invitación enviada a {invitation_data.email}")
        
    except Exception as e:
        print(f"❌ Error enviando invitación: {e}")
        # En desarrollo, imprimimos el link por si falla el correo
        print(f"🔗 LINK RESPALDO: {invite_link}")

    db.commit()
    db.refresh(db_invitation)
    return db_invitation

def accept_invitation(db: Session, data: schemas.InvitationAccept):
    """
    1. Valida el token.
    2. Crea el usuario con los datos que él mismo puso.
    3. Marca la invitación como usada.
    """
    # Buscar invitación
    invite = db.query(models.UserInvitation).filter(
        models.UserInvitation.token == data.token,
        models.UserInvitation.is_used == False
    ).first()

    if not invite:
        raise ValueError("La invitación no existe o ya fue utilizada.")
    
    # Verificar expiración (simple comparison assuming UTC awareness or similar setup)
    if invite.expires_at < datetime.now(pytz.utc):
        raise ValueError("La invitación ha caducado. Pide una nueva.")

    # Crear el usuario
    hashed_password = security.get_password_hash(data.password)
    hashed_pin = security.get_password_hash(data.pin)

    new_user = models.User(
        email=invite.email,
        hashed_password=hashed_password,
        hashed_pin=hashed_pin,
        role=invite.role,
        is_active=True, # Entra activo directo
        company_id=invite.company_id,
        full_name=data.full_name,
        id_card=data.id_card,
        emergency_contact=data.emergency_contact
    )
    db.add(new_user)
    
    # Marcar invitación como usada
    invite.is_used = True
    
    db.commit()
    db.refresh(new_user)
    return new_user

# --- INICIO DE NUESTRO CÓDIGO (ASISTENTE DE CONFIGURACIÓN) ---

def get_user_count(db: Session) -> int:
    """
    Cuenta el número total de usuarios en la base de datos.
    Es como asomarse a la oficina a ver si hay alguien.
    """
    # Contamos cuántas filas hay en la tabla "users"
    return db.query(models.User).count()

def create_first_admin_user(db: Session, user_data: schemas.FirstAdminCreate):
    """
    Crea el PRIMER usuario administrador (el dueño de la caja fuerte).
    Solo funciona si no hay otros usuarios en la base de datos.
    """
    # 1. Doble chequeo para seguridad:
    # Si al asomarnos (get_user_count) vemos que hay 1 o más personas...
    if get_user_count(db) > 0:
        # ...cerramos la puerta y damos un error.
        raise ValueError("La base de datos ya tiene usuarios. La configuración inicial está bloqueada.")
    
    # 2. Si no hay nadie (conteo es 0), creamos el usuario
    hashed_password = security.get_password_hash(user_data.password)
    db_user = models.User(
        email=user_data.email,
        hashed_password=hashed_password,
        role="admin", # Le damos el rol de "admin" (jefe)
        is_active=True
    )
    db.add(db_user)
    db.commit() # Guardamos el usuario para obtener su ID
    db.refresh(db_user)

    # 3. Añadir el PIN
    # (Llamamos a la función que ya existe para esto, 'set_user_pin')
    set_user_pin(db=db, user_id=db_user.id, pin=user_data.pin)
    
    db.refresh(db_user)
    return db_user

# --- NUEVA FUNCIÓN: REGISTRO COMPLETO DE EMPRESA (SaaS) ---
def register_new_company(db: Session, data: schemas.CompanyRegister):
    """
    Crea TODO el ecosistema para un nuevo cliente:
    1. La Empresa.
    2. El Usuario Admin.
    3. La Sucursal Principal y Bodega.
    4. La Configuración por defecto.
    """
    # 1. Verificar duplicados (Email único globalmente en usuarios)
    if get_user_by_email(db, data.admin_email):
        raise ValueError("El correo electrónico ya está registrado.")
    
    # 2. Verificar nombre de empresa único
    existing_company = db.query(models.Company).filter(models.Company.name == data.company_name).first()
    if existing_company:
        raise ValueError("El nombre de la empresa ya existe. Por favor elija otro.")

    # 3. Crear la Empresa (El Inquilino)
    new_company = models.Company(name=data.company_name, plan_type="FREE", is_active=True)
    db.add(new_company)
    db.flush() # Para obtener el ID de la empresa

    # 4. Crear el Usuario Admin (El Dueño)
    hashed_password = security.get_password_hash(data.admin_password)
    hashed_pin = security.get_password_hash(data.admin_pin)
    
    # --- GENERAR CÓDIGO DE VERIFICACIÓN (6 Dígitos) ---
    verification_code = ''.join(random.choices(string.digits, k=6))
    
    # --- ENVÍO DE CORREO REAL (GMAIL) ---
    try:
        # 1. Configuración del Cartero (Cambia esto con tus datos reales)
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "programador.ecu@gmail.com" # <--- PON AQUÍ TU GMAIL
        sender_password = "sjvg bgag xdkp zlaa" # <--- PON AQUÍ LA CLAVE DE 16 LETRAS
        
        # 2. Escribir la carta
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = data.admin_email
        msg['Subject'] = "Tu Código de Verificación - ReparaSystem"

        body = f"""
        Hola,
        
        Bienvenido a ReparaSystem.
        Tu código de seguridad para activar la cuenta es:
        
        {verification_code}
        
        Si no solicitaste este registro, ignora este mensaje.
        """
        msg.attach(MIMEText(body, 'plain'))

        # 3. Entregar la carta al servidor
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls() # Encriptar conexión (seguridad)
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, data.admin_email, text)
        server.quit()
        
        print(f"✅ Correo enviado exitosamente a {data.admin_email}")
        
    except Exception as e:
        print(f"❌ Error enviando correo: {e}")
        # IMPORTANTE: Si falla el correo, igual imprimimos el código en consola
        # para que no te quedes bloqueado haciendo pruebas.
        print(f"📧 [RESPALDO] CÓDIGO: {verification_code}")

    new_admin = models.User(
        email=data.admin_email,
        hashed_password=hashed_password,
        hashed_pin=hashed_pin,
        role="admin",
        is_active=False, # <--- IMPORTANTE: Nace inactivo hasta que verifique
        verification_code=verification_code, # Guardamos el código
        company_id=new_company.id 
    )
    db.add(new_admin)
    db.flush() # Para obtener el ID del usuario

    # 5. Crear Sucursal Principal (Oficina)
    sucursal = models.Location(
        name="Sucursal Principal",
        description="Oficina creada automáticamente",
        address="Dirección pendiente",
        parent_id=None,
        company_id=new_company.id
    )
    db.add(sucursal)
    db.flush()

    # 6. Crear Bodega Principal
    bodega = models.Location(
        name="Bodega Principal",
        description="Almacén general",
        address="Dirección pendiente",
        parent_id=sucursal.id, # Vinculada a la sucursal
        company_id=new_company.id
    )
    db.add(bodega)

    # 7. Crear Caja de Ventas
    caja = models.CashAccount(
        name="CAJA PRINCIPAL",
        account_type="CAJA_VENTAS",
        location_id=sucursal.id,
        company_id=new_company.id
    )
    db.add(caja)

    # 8. Crear Configuración por Defecto (Identidad)
    settings = models.CompanySettings(
        company_id=new_company.id,
        name=data.company_name,
        ruc="9999999999001",
        footer_message="Gracias por su preferencia"
    )
    db.add(settings)

    # 9. Guardar todo
    db.commit()
    db.refresh(new_admin)
    
    return new_admin
    # --- FIN DE NUESTRO CÓDIGO ---

def verify_user_account(db: Session, email: str, code: str):
    """
    Activa la cuenta si el código coincide.
    """
    user = get_user_by_email(db, email=email)
    if not user:
        raise ValueError("Usuario no encontrado.")
    
    if user.is_active:
        return True # Ya estaba activo
        
    if not user.verification_code or user.verification_code != code:
        raise ValueError("Código de verificación incorrecto.")
    
    # Si todo coincide:
    user.is_active = True
    user.verification_code = None # Limpiamos el código
    db.commit()
    db.refresh(user)
    return True

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

    return (
        db.query(models.LostSaleLog)
        .options(
            selectinload(models.LostSaleLog.user),
            selectinload(models.LostSaleLog.location),
        )
        .filter(models.LostSaleLog.id == db_log.id)
        .first()
    )

def get_lost_sale_logs(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.LostSaleLog)
        .options(
            selectinload(models.LostSaleLog.user),
            selectinload(models.LostSaleLog.location),
        )
        .order_by(models.LostSaleLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

# ===================================================================
# --- ÓRDENES DE TRABAJO ---
# ===================================================================
def get_work_order(db: Session, work_order_id: int):
    order = (
        db.query(models.WorkOrder)
        .options(
            joinedload(models.WorkOrder.user),
            joinedload(models.WorkOrder.location),
            selectinload(models.WorkOrder.images),
            selectinload(models.WorkOrder.notes).selectinload(models.WorkOrderNote.user),
            selectinload(models.WorkOrder.notes).selectinload(models.WorkOrderNote.location),
        )
        .filter(models.WorkOrder.id == work_order_id)
        .first()
    )
    # --- AUTO-GENERACIÓN DE PUBLIC_ID PARA ÓRDENES ANTIGUAS ---
    if order and not order.public_id:
        order.public_id = str(uuid.uuid4())
        db.commit()
        db.refresh(order)
    # ----------------------------------------------------------
    return order

def get_work_order_by_public_id(db: Session, public_id: str):
    """Busca una orden usando su código secreto público"""
    return (
        db.query(models.WorkOrder)
        .options(
            joinedload(models.WorkOrder.user),
            joinedload(models.WorkOrder.location),
            selectinload(models.WorkOrder.images),
            selectinload(models.WorkOrder.notes).selectinload(models.WorkOrderNote.user),
            selectinload(models.WorkOrder.notes).selectinload(models.WorkOrderNote.location),
        )
        .filter(models.WorkOrder.public_id == public_id)
        .first()
    )



def get_work_orders(db: Session, user: models.User, skip: int = 0, limit: int = 100, active_only: bool = False, search: str | None = None):
    """
    Obtiene las órdenes de trabajo y AUTO-REPARA los public_id faltantes.
    """
    query = db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    )

    # --- FILTRO DE BÚSQUEDA (Nombre o Cédula) ---
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.WorkOrder.customer_name).like(search_term),
                func.lower(models.WorkOrder.customer_id_card).like(search_term),
                # También buscamos por el ID de la orden (si es un número)
                cast(models.WorkOrder.id, String).like(search_term)
            )
        )
    # --------------------------------------------

    # --- NUEVO FILTRO: Si pedimos solo activas, ignoramos las terminadas ---
    if active_only:
        # Trae todo LO QUE NO SEA "ENTREGADO" ni "SIN_REPARACION"
        query = query.filter(models.WorkOrder.status.notin_(["ENTREGADO", "SIN_REPARACION"]))
    # -----------------------------------------------------------------------

    if user.role not in ["super_admin", "admin", "inventory_manager"]:
        active_shift = get_active_shift_for_user(db, user_id=user.id)
        if not active_shift:
            return [] 
        query = query.filter(models.WorkOrder.location_id == active_shift.location_id)

    results = query.order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

    # --- BLOQUE DE AUTO-REPARACIÓN ---
    # Si encontramos órdenes sin código público, se lo creamos ahora mismo.
    has_changes = False
    for order in results:
        if not order.public_id:
            order.public_id = str(uuid.uuid4())
            has_changes = True
    
    if has_changes:
        db.commit() # Guardamos los nuevos códigos generados
        # No necesitamos refrescar, el objeto en memoria ya tiene el ID
    # ---------------------------------

    return results

def create_work_order(db: Session, work_order: schemas.WorkOrderCreate, user_id: int, location_id: int):
    # Recuperamos al usuario para saber su COMPANY ID
    user = db.query(models.User).get(user_id)
    company_id = user.company_id

    # --- INICIO LÓGICA CLIENTE INTELIGENTE (UPSERT) ---
    existing_customer = get_customer_by_id_card(db, id_card=work_order.customer_id_card, company_id=company_id)

    if existing_customer:
        # Si el cliente YA EXISTE, actualizamos sus datos con la info fresca de esta orden.
        # Así, si cambió de teléfono o dirección, se actualiza la ficha general.
        existing_customer.name = work_order.customer_name
        existing_customer.phone = work_order.customer_phone
        existing_customer.email = work_order.customer_email
        existing_customer.address = work_order.customer_address
        # No hace falta db.add, SQLAlchemy detecta el cambio en el objeto "dirty"
    else:
        # Si NO EXISTE, creamos la ficha del cliente nuevo automáticamente.
        new_customer = models.Customer(
            id_card=work_order.customer_id_card,
            name=work_order.customer_name,
            phone=work_order.customer_phone,
            email=work_order.customer_email,
            address=work_order.customer_address,
            location_id=location_id,
            company_id=company_id, # <--- ASIGNACIÓN IMPORTANTE
            notes="Cliente registrado automáticamente desde Orden de Trabajo"
        )
        db.add(new_customer)
    # --- FIN LÓGICA CLIENTE INTELIGENTE ---

    # 1. Crear la Orden de Trabajo básica
    # --- CAMBIO: Excluimos también el ID de la cuenta bancaria para que no de error ---
    work_order_data = work_order.model_dump(exclude={"pin", "deposit_payment_method", "deposit_bank_account_id"})
    # Asignamos la company_id también a la Orden
    db_work_order = models.WorkOrder(**work_order_data, user_id=user_id, location_id=location_id, company_id=company_id)
    db.add(db_work_order)
    db.flush() # Obtenemos el ID de la orden

    # --- INICIO LÓGICA ADELANTO = VENTA ---
    # Si hay un adelanto mayor a 0, creamos una VENTA automática
    if work_order.deposit_amount > 0:
        # Preparamos el ítem de venta
        deposit_item = schemas.SaleItemCreate(
            product_id=None, # No es un producto físico
            description=f"ADELANTO ORDEN #{db_work_order.id} - {work_order.device_model}",
            quantity=1,
            unit_price=work_order.deposit_amount
        )

        # Preparamos el pago
        payment_detail = schemas.PaymentDetail(
            method=work_order.deposit_payment_method,
            amount=work_order.deposit_amount,
            reference="Adelanto Automático",
            bank_account_id=work_order.deposit_bank_account_id # <--- PASAMOS LA CUENTA AL PAGO
        )

        # Creamos la estructura de venta
        sale_create = schemas.SaleCreate(
            payment_method="MIXTO",
            payments=[payment_detail],
            iva_percentage=0, # Usualmente adelantos no desglosan IVA hasta el final, o según tu política.
            customer_ci=work_order.customer_id_card,
            customer_name=work_order.customer_name,
            customer_phone=work_order.customer_phone,
            customer_address=work_order.customer_address,
            customer_email=work_order.customer_email,
            items=[deposit_item],
            pin=work_order.pin, # Reusamos el PIN
            work_order_id=db_work_order.id # Vinculamos la venta a la orden
        )

        # Llamamos a nuestra función de venta existente (ella se encarga de la caja, el cliente inteligente, etc.)
        # Nota: create_sale hace commit, así que la orden también se guardará.
        try:
            create_sale(db, sale_create, user_id, location_id)
        except Exception as e:
            # Si falla la venta del adelanto, fallamos todo
            db.rollback()
            raise e
    else:
        # Si no hubo adelanto, hacemos commit solo de la orden
        db.commit()
    # --- FIN LÓGICA ADELANTO = VENTA ---

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

def search_ready_work_orders(db: Session, user: models.User, search: str | None = None, skip: int = 0, limit: int = 100):
    query = db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    ).filter(models.WorkOrder.status == 'LISTO')

    if user.role not in ["super_admin", "admin", "inventory_manager"]:
        active_shift = get_active_shift_for_user(db, user_id=user.id)
        if not active_shift: return []
        query = query.filter(models.WorkOrder.location_id == active_shift.location_id)

    if search:
        search_term_like = f"%{search.lower()}%"
        search_term_int = None
        try:
            search_term_int = int(search)
        except ValueError:
            pass

        filters = [
            func.lower(models.WorkOrder.customer_name).like(search_term_like),
            func.lower(models.WorkOrder.customer_id_card).like(search_term_like)
        ]
        if search_term_int is not None:
            filters.append(models.WorkOrder.id == search_term_int)

        query = query.filter(or_(*filters))

    results = query.order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

    # --- AUTO-REPARACIÓN ---
    has_changes = False
    for order in results:
        if not order.public_id:
            order.public_id = str(uuid.uuid4())
            has_changes = True
    if has_changes: db.commit()
    # -----------------------

    return results

    # Aplicar filtro de permisos basado en rol y turno (igual que en get_work_orders)
    if user.role not in ["admin", "inventory_manager"]:
        active_shift = get_active_shift_for_user(db, user_id=user.id)
        if not active_shift:
            return [] # Sin turno activo, no puede ver órdenes
        query = query.filter(models.WorkOrder.location_id == active_shift.location_id)

    # Aplicar filtro de búsqueda si se proporciona
    if search:
        search_term_like = f"%{search.lower()}%"
        # Intentar convertir búsqueda a número para buscar por ID
        search_term_int = None
        try:
            search_term_int = int(search)
        except ValueError:
            pass # No es un número válido para ID

        filters = [
            func.lower(models.WorkOrder.customer_name).like(search_term_like),
            func.lower(models.WorkOrder.customer_id_card).like(search_term_like)
        ]
        if search_term_int is not None:
            filters.append(models.WorkOrder.id == search_term_int)

        query = query.filter(or_(*filters)) # Usamos or_ para buscar en cualquiera de los campos

    # Ordenar y devolver resultados
    return query.order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

def create_work_order_note(db: Session, work_order_id: int, user_id: int, location_id: int, message: str):
    """Crea una nota interna para una orden de trabajo."""
    note = models.WorkOrderNote(
        work_order_id=work_order_id,
        user_id=user_id,
        location_id=location_id,
        message=message
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    # Devolvemos con relaciones cargadas:
    return (
        db.query(models.WorkOrderNote)
        .options(
            selectinload(models.WorkOrderNote.user),
            selectinload(models.WorkOrderNote.location),
        )
        .filter(models.WorkOrderNote.id == note.id)
        .first()
    )

def get_work_order_notes(db: Session, work_order_id: int, skip: int = 0, limit: int = 100):
    """Lista notas de una orden (más recientes primero)."""
    return (
        db.query(models.WorkOrderNote)
        .options(
            selectinload(models.WorkOrderNote.user),
            selectinload(models.WorkOrderNote.location),
        )
        .filter(models.WorkOrderNote.work_order_id == work_order_id)
        .order_by(models.WorkOrderNote.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ===================================================================
# --- PROVEEDORES ---
# ===================================================================
def get_supplier(db: Session, supplier_id: int):
    return db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()

def get_suppliers(db: Session, company_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Supplier).filter(models.Supplier.company_id == company_id).order_by(models.Supplier.name).offset(skip).limit(limit).all()

def create_supplier(db: Session, supplier: schemas.SupplierCreate, company_id: int):
    db_supplier = models.Supplier(**supplier.model_dump(), company_id=company_id)
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
def get_purchase_invoices(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.PurchaseInvoice)
        .options(
            selectinload(models.PurchaseInvoice.supplier),
            selectinload(models.PurchaseInvoice.items).selectinload(models.PurchaseInvoiceItem.product),
            selectinload(models.PurchaseInvoice.user),
        )
        .order_by(models.PurchaseInvoice.invoice_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def create_purchase_invoice(db: Session, invoice: schemas.PurchaseInvoiceCreate, user_id: int, location_id: int):
    try:
        # --- LÓGICA DE DESTINO ROBUSTA ---
        # 1. ¿El usuario eligió un destino explícito en el formulario? Usamos ese.
        # 2. ¿No eligió? Usamos la ubicación de su turno actual (location_id) como fallback.
        dest_sucursal_id = invoice.target_location_id if invoice.target_location_id else location_id

        # 3. Ahora buscamos la BODEGA asociada a esa Sucursal.
        # (El stock siempre entra a la Bodega, no al piso de venta)
        bodega = get_primary_bodega_for_location(db, location_id=dest_sucursal_id)
        
        # 4. Definimos el ID final donde se guardará el stock
        final_stock_location_id = bodega.id if bodega else dest_sucursal_id
        # ------------------------------------

        total_cost = 0
        invoice_items_to_create = []
        
        for item in invoice.items:
            line_total = item.quantity * item.cost_per_unit
            total_cost += line_total
            
            # --- COSTO PROMEDIO PONDERADO (REFORZADO) ---
            product = get_product(db, item.product_id)
            if product:
                # Sumamos stock total de la empresa para el cálculo
                total_current_stock = db.query(func.sum(models.Stock.quantity)).filter(
                    models.Stock.product_id == item.product_id
                ).scalar() or 0

                if total_current_stock <= 0:
                    # Si no hay stock, el costo es simplemente el de esta compra
                    product.average_cost = item.cost_per_unit
                else:
                    # Fórmula: ((Stock * Costo) + (Nuevo * Precio)) / (Stock + Nuevo)
                    current_value = total_current_stock * product.average_cost
                    new_value = item.quantity * item.cost_per_unit
                    total_quantity = total_current_stock + item.quantity
                    
                    # Actualizamos el costo promedio del producto
                    product.average_cost = (current_value + new_value) / total_quantity
                
                db.add(product) 
            # --------------------------------------------

            invoice_items_to_create.append(
                models.PurchaseInvoiceItem(
                    product_id=item.product_id, 
                    quantity=item.quantity, 
                    cost_per_unit=item.cost_per_unit
                )
            )
        
        db_invoice = models.PurchaseInvoice(
            invoice_number=invoice.invoice_number, 
            invoice_date=invoice.invoice_date, 
            total_cost=total_cost, 
            supplier_id=invoice.supplier_id, 
            user_id=user_id, 
            items=invoice_items_to_create
        )
        db.add(db_invoice)
        db.flush()

        for item in invoice.items:
            movement = schemas.InventoryMovementCreate(
                product_id=item.product_id, 
                # USAMOS LA BODEGA CALCULADA AQUÍ
                location_id=final_stock_location_id, 
                quantity_change=item.quantity, 
                movement_type="ENTRADA_COMPRA", 
                reference_id=f"COMPRA-{db_invoice.id}", 
                pin=invoice.pin
            )
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
# --- INICIO DE NUESTRO CÓDIGO (Venta con Pagos Mixtos y Costo Histórico) ---
def create_sale(db: Session, sale: schemas.SaleCreate, user_id: int, location_id: int):
    try:
        # Recuperamos al usuario para saber su COMPANY ID
        user = db.query(models.User).get(user_id)
        company_id = user.company_id

        bodega = get_primary_bodega_for_location(db, location_id=location_id)
        if not bodega:
            raise ValueError(f"La sucursal con ID {location_id} no tiene una bodega configurada.")

        if not sale.items:
            raise ValueError("La venta debe incluir al menos un ítem.")
        
        # --- INICIO LÓGICA CLIENTE INTELIGENTE ---
        existing_customer = get_customer_by_id_card(db, id_card=sale.customer_ci, company_id=company_id)
        
        if existing_customer:
            existing_customer.name = sale.customer_name
            existing_customer.phone = sale.customer_phone
            existing_customer.email = sale.customer_email
            existing_customer.address = sale.customer_address
        else:
            new_customer = models.Customer(
                id_card=sale.customer_ci,
                name=sale.customer_name,
                phone=sale.customer_phone,
                email=sale.customer_email,
                address=sale.customer_address,
                location_id=location_id,
                company_id=company_id, # <--- ASIGNACIÓN
                notes="Cliente registrado automáticamente desde Venta"
            )
            db.add(new_customer)
        # --- FIN LÓGICA CLIENTE INTELIGENTE ---

        # --- SOLUCIÓN AL PROBLEMA DEL DOBLE INGRESO ---
        # Si esta venta es el cierre de una orden, debemos ANULAR la venta del anticipo 
        # para que la nueva venta la reemplace completamente.
        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            
            # Verificamos si la orden ya tiene una venta asociada (el anticipo)
            if db_work_order and db_work_order.sale:
                # ¡AQUÍ ESTÁ LA SOLUCIÓN! 
                # Eliminamos la venta anterior (el anticipo) de la base de datos
                # para que no cuente doble en el reporte financiero.
                # El dinero del anticipo se vuelve a registrar en esta nueva venta como "ANTICIPO".
                db.delete(db_work_order.sale)
                db.flush() # Aplicamos la eliminación antes de crear la nueva

            if db_work_order and (db_work_order.deposit_amount or 0) > 0:
                real_total = db_work_order.final_cost if db_work_order.final_cost is not None else db_work_order.estimated_cost
                pending_balance = real_total - db_work_order.deposit_amount
                
                amount_paying_now = sum(p.amount for p in sale.payments)

                if abs(amount_paying_now - pending_balance) < 0.02:
                    
                    if sale.items:
                        sale.items[0].unit_price = real_total

                    current_method = sale.payments[0].method if sale.payments else "EFECTIVO"
                    
                    new_payments = []
                    new_payments.append(schemas.PaymentDetail(
                        method="ANTICIPO",
                        amount=db_work_order.deposit_amount,
                        reference="Abono previo"
                    ))
                    new_payments.append(schemas.PaymentDetail(
                        method=current_method,
                        amount=amount_paying_now,
                        reference="Cancelación de saldo"
                    ))
                    
                    sale.payments = new_payments
                    sale.payment_method = "MIXTO" 
        # ---------------------------------------------------

        # 1. Calcular totales y PREPARAR ITEMS CON COSTO
        subtotal_decimal = Decimal("0.00")
        sale_items_to_create = []
        for item in sale.items:
            line_total_decimal = Decimal(item.quantity) * Decimal(str(item.unit_price))
            subtotal_decimal += line_total_decimal
            line_total = line_total_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            # --- CAPTURAR EL COSTO DEL MOMENTO ---
            current_product_cost = 0.0
            if item.product_id:
                product = get_product(db, item.product_id)
                if product:
                    # Usamos el costo promedio que tiene el producto AHORA MISMO
                    current_product_cost = product.average_cost
            # -------------------------------------

            sale_items_to_create.append(
                models.SaleItem(
                    **item.model_dump(),
                    line_total=float(line_total),
                    recorded_cost=current_product_cost # Guardamos el costo para el reporte
                )
            )

        subtotal_decimal = subtotal_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        iva_rate = Decimal(str(sale.iva_percentage)) / Decimal("100")
        tax_amount_decimal = (subtotal_decimal * iva_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_amount_decimal = (subtotal_decimal + tax_amount_decimal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        subtotal_amount = float(subtotal_decimal)
        tax_amount = float(tax_amount_decimal)
        total_amount = float(total_amount_decimal)

        # 2. Validar que los pagos cubran el total
        total_paid = sum(p.amount for p in sale.payments)
        if abs(total_paid - total_amount) > 0.02:
             raise ValueError(f"El total pagado (${total_paid}) no coincide con el total de la venta (${total_amount}).")

        # 3. Determinar método principal
        main_method = "MIXTO"
        if len(sale.payments) == 1:
            main_method = sale.payments[0].method

        # 4. Guardar detalles de pago en el JSON
        payment_details_json = [p.model_dump() for p in sale.payments]

        db_sale = models.Sale(
            subtotal_amount=subtotal_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            iva_percentage=sale.iva_percentage,
            payment_method=main_method,
            payment_method_details=payment_details_json,
            
            customer_ci=sale.customer_ci,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            customer_address=sale.customer_address,
            customer_email=sale.customer_email,

            warranty_terms=sale.warranty_terms,

            user_id=user_id,
            location_id=location_id,
            company_id=company_id, # <--- ASIGNACIÓN
            work_order_id=sale.work_order_id,
            items=sale_items_to_create
        )
        db.add(db_sale)
        db.flush()

        # 5. Mover inventario
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

        # 6. Procesar Pagos (Caja, Bancos y Notas de Crédito)
        db_caja_ventas = db.query(models.CashAccount).filter(
            models.CashAccount.location_id == location_id,
            models.CashAccount.account_type == "CAJA_VENTAS"
        ).first()

        for payment in sale.payments:
            # --- EFECTIVO -> Caja de Ventas Local ---
            if payment.method == "EFECTIVO":
                if db_caja_ventas:
                    db_transaction = models.CashTransaction(
                        amount=payment.amount,
                        description=f"Ingreso Venta #{db_sale.id} (Efectivo)",
                        user_id=user_id,
                        account_id=db_caja_ventas.id
                    )
                    db.add(db_transaction)

            # --- TRANSFERENCIA -> Cuenta Bancaria Seleccionada ---
            elif payment.method == "TRANSFERENCIA":
                # Si el usuario eligió un banco específico en el modal
                if payment.bank_account_id:
                    # Verificar que la cuenta exista
                    target_bank = get_cash_account(db, payment.bank_account_id)
                    if target_bank:
                        db_transaction = models.CashTransaction(
                            amount=payment.amount,
                            description=f"Ingreso Venta #{db_sale.id} (Transf: {payment.reference or 'Sin Ref'})",
                            user_id=user_id,
                            account_id=target_bank.id
                        )
                        db.add(db_transaction)
            
            # --- NOTA DE CRÉDITO ---
            elif payment.method == "CREDIT_NOTE":
                note_code = payment.reference
                if not note_code:
                    raise ValueError("Se requiere el código de la Nota de Crédito.")
                
                credit_note = db.query(models.CreditNote).filter(
                    models.CreditNote.code == note_code,
                    models.CreditNote.is_active == True
                ).with_for_update().first()

                if not credit_note:
                    raise ValueError(f"La Nota de Crédito '{note_code}' no existe o ya fue utilizada.")
                
                if credit_note.amount < (payment.amount - 0.02):
                     raise ValueError(f"La Nota de Crédito tiene ${credit_note.amount}, pero intentas cobrar ${payment.amount}.")

                credit_note.is_active = False
                credit_note.reason += f" (Usada en Venta #{db_sale.id})"

        # 7. Actualizar Orden de Trabajo (si aplica)
        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            if db_work_order:
                pending_balance = db_work_order.estimated_cost - db_work_order.deposit_amount
                
                if subtotal_amount >= (pending_balance - 0.02):
                    if db_work_order.status == "LISTO":
                        db_work_order.status = "ENTREGADO"
                        db_work_order.final_cost = db_work_order.estimated_cost

        db.commit()
        db.refresh(db_sale)
        return db_sale

    except ValueError as e:
        db.rollback()
        # CAMBIO: En lugar de "romper" el servidor (500), enviamos una Alerta (400)
        # Esto hará que en el POS salga un mensaje rojo con el detalle del error (ej: "Stock insuficiente...")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        # Para otros errores no previstos, sí lanzamos el error general
        raise HTTPException(status_code=500, detail=f"Error interno al procesar la venta: {str(e)}")
# --- FIN DE NUESTRO CÓDIGO ---


def get_sale(db: Session, sale_id: int):
    sale = (
        db.query(models.Sale)
        .options(
            joinedload(models.Sale.user),
            joinedload(models.Sale.location),
            joinedload(models.Sale.items).joinedload(models.SaleItem.product),
        )
        .filter(models.Sale.id == sale_id)
        .first()
    )
    # --- AUTO-GENERACIÓN DE PUBLIC_ID PARA VENTAS ANTIGUAS ---
    # Si la venta existe pero no tiene código secreto, se lo creamos ahora mismo.
    if sale and not sale.public_id:
        sale.public_id = str(uuid.uuid4())
        db.commit()
        db.refresh(sale)
    # ---------------------------------------------------------
    return sale

def get_sale_by_public_id(db: Session, public_id: str):
    """Busca una venta usando su código secreto público"""
    return (
        db.query(models.Sale)
        .options(
            joinedload(models.Sale.user),
            joinedload(models.Sale.location),
            joinedload(models.Sale.items).joinedload(models.SaleItem.product),
        )
        .filter(models.Sale.public_id == public_id)
        .first()
    )

# --- INICIO DE NUESTRO CÓDIGO ---
# Esta es la nueva función (¡MEJORADA!) para buscar en el "archivador"
def get_sales(
    db: Session, 
    user: models.User, 
    skip: int = 0, 
    limit: int = 100,
    # --- NUEVOS PARÁMETROS PARA EL BUSCADOR INTELIGENTE ---
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    location_id: int | None = None  # <--- ¡AQUÍ ESTÁ EL PARÁMETRO NUEVO!
):
    """
    Obtiene el historial de ventas con lógica de permisos Y FILTROS.
    - Admins/Managers ven todas las ventas.
    - Otros roles (vendedores) solo ven las de su turno activo.
    - Filtra por rango de fechas y por término de búsqueda (cliente/cédula).
    """
    # 1. Preparamos la consulta (esto no cambia)
    query = db.query(models.Sale).options(
        selectinload(models.Sale.user),
        selectinload(models.Sale.location),
        selectinload(models.Sale.items).selectinload(models.SaleItem.product),
    )

    # --- INICIO DE LA LÓGICA DE PERMISOS CORREGIDA (CON INDENTACIÓN) ---
    # 2. Lógica de permisos y filtrado por sucursal
    if user.role in ["super_admin", "admin", "inventory_manager"]:
        # Si es Super Admin, Admin o Gerente, PUEDE filtrar por sucursal.
        if location_id:
            # Si se le pasa un ID, filtra por ese ID
            query = query.filter(models.Sale.location_id == location_id)
        # Si location_id es None (el usuario eligió "Todas"), 
        # no se aplica filtro y verá todas las sucursales.
    else:
        # Si es un empleado normal, IGNORA el location_id que haya
        # intentado enviar y SIEMPRE filtra por su turno activo.
        active_shift = get_active_shift_for_user(db, user_id=user.id)
        if not active_shift:
            return []  # <--- ESTE 'return' AHORA SÍ ESTÁ DENTRO DE LA FUNCIÓN
        query = query.filter(models.Sale.location_id == active_shift.location_id)
    # --- FIN DE LA LÓGICA DE PERMISOS ---

    # --- INICIO DE LA NUEVA LÓGICA DE FILTROS ---
    # 3. Aplicamos el filtro de "Fecha Inicio" si existe
    if start_date:
        # func.date() extrae solo la fecha (ej: '2025-10-31') de la hora completa
        query = query.filter(func.date(models.Sale.created_at) >= start_date)

    # 4. Aplicamos el filtro de "Fecha Fin" si existe
    if end_date:
        query = query.filter(func.date(models.Sale.created_at) <= end_date)

    # 5. Aplicamos el filtro de búsqueda de texto si existe
    if search:
        search_term = f"%{search.lower()}%" # Buscamos el texto en mayúsculas/minúsculas
        query = query.filter(
            or_(
                # Busca en el nombre del cliente
                func.lower(models.Sale.customer_name).like(search_term),
                # O busca en la cédula del cliente
                func.lower(models.Sale.customer_ci).like(search_term)
            )
        )
    # --- FIN DE LA NUEVA LÓGICA DE FILTROS ---

    # 6. Ejecutamos consulta y AUTO-REPARAMOS IDs faltantes
    results = query.order_by(models.Sale.created_at.desc()).offset(skip).limit(limit).all()
    
    has_changes = False
    for sale in results:
        if not sale.public_id:
            sale.public_id = str(uuid.uuid4())
            has_changes = True
    
    if has_changes:
        db.commit()

    return results
# --- FIN DE NUESTRO CÓDIGO ---


# ===================================================================
# --- GESTIÓN DE CAJA ---
# ===================================================================
def create_cash_account(db: Session, account: schemas.CashAccountCreate, company_id: int):
    # Convertimos el nombre a MAYÚSCULAS antes de guardar
    account_data = account.model_dump()
    account_data['name'] = account_data['name'].upper()
    
    # Asignamos la cuenta a la empresa
    db_account = models.CashAccount(**account_data, company_id=company_id)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def get_cash_accounts_by_location(db: Session, location_id: int, company_id: int):
    """
    Devuelve cuentas de la sucursal Y cuentas globales (Bancos) DE MI EMPRESA.
    """
    return db.query(models.CashAccount).filter(
        models.CashAccount.company_id == company_id, # <--- FILTRO MAESTRO
        or_(
            models.CashAccount.location_id == location_id,
            models.CashAccount.location_id == None # Cuentas Globales
        )
    ).all()

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

# --- INICIO DE NUESTRO CÓDIGO (Cierre de Caja) ---
def get_cash_account_balance(db: Session, account_id: int) -> float:
    """
    Calcula el saldo total de una cuenta sumando todos sus movimientos.
    (Esta es la "pantalla digital" de la caja).
    """
    # Usamos func.sum() para que la base de datos haga la suma por nosotros.
    # Coalesce es para que devuelva 0 si no hay transacciones (en lugar de 'None').
    total = db.query(func.sum(models.CashTransaction.amount)).filter(
        models.CashTransaction.account_id == account_id
    ).scalar() or 0.0
    
    # Redondeamos a 2 decimales por si acaso
    return round(total, 2)
# --- FIN DE NUESTRO CÓDIGO ---

# ===================================================================
# --- REPORTES ---
# ===================================================================
def get_dashboard_summary(db: Session, location_id: int, target_date: date):
    # Calcula ventas totales del día en la ubicación
    # BLINDAJE: Si os.getenv devuelve cadena vacía, forzamos el default
    app_timezone = os.getenv("TZ")
    if not app_timezone: 
        app_timezone = "America/Guayaquil"

    total_sales = db.query(func.sum(models.Sale.total_amount)).filter(
        models.Sale.location_id == location_id,
        func.date(func.timezone(app_timezone, models.Sale.created_at)) == target_date
    ).scalar() or 0.0

    # Calcula gastos totales del día en la ubicación
    # CORRECCIÓN: Solo sumamos gastos que salieron de la CAJA DE VENTAS (dinero del día).
    # La Caja Chica es un fondo aparte y no debe afectar el balance diario de ventas.
    cash_accounts = db.query(models.CashAccount).filter(
        models.CashAccount.location_id == location_id,
        models.CashAccount.account_type == 'CAJA_VENTAS' 
    ).all()
    account_ids = [acc.id for acc in cash_accounts]

    total_expenses = 0.0
    if account_ids:
        # Reutilizamos la variable app_timezone que definimos arriba
        total_expenses = db.query(func.sum(models.CashTransaction.amount)).filter(
            models.CashTransaction.account_id.in_(account_ids),
            models.CashTransaction.amount < 0,
            # --- NUEVO FILTRO: Excluir Cierres de Caja ---
            # Usamos NOT ILIKE para que ignore mayúsculas/minúsculas
            models.CashTransaction.description.notilike("CIERRE DE CAJA%"), 
            # ---------------------------------------------
            func.date(func.timezone(app_timezone, models.CashTransaction.timestamp)) == target_date
        ).scalar() or 0.0
    total_expenses = abs(total_expenses)

    # --- SECCIÓN CORREGIDA ---
    # Cuenta las órdenes de trabajo por estado
    status_counts = db.query(models.WorkOrder.status, func.count(models.WorkOrder.id)).filter(
        models.WorkOrder.location_id == location_id
    ).group_by(models.WorkOrder.status).all()

    # 1. Creamos el diccionario con las claves CORRECTAS y valor 0
    work_order_summary = {
        "por_reparar": 0,
        "en_espera": 0,
        "reparando": 0,
        "listo_para_entrega": 0,
        "entregado": 0,
        "sin_reparacion": 0,
    }

    # 2. Mapeamos los estados de la base de datos a nuestras claves
    status_map = {
        "RECIBIDO": "por_reparar",
        "EN_REVISION": "en_espera",
        "REPARANDO": "reparando",
        "LISTO": "listo_para_entrega",
        "ENTREGADO": "entregado",
        "SIN_REPARACION": "sin_reparacion"
    }

    # 3. Rellenamos el diccionario con los conteos reales
    for status_from_db, count in status_counts:
        if status_from_db in status_map:
            key = status_map[status_from_db]
            work_order_summary[key] = count
    # --- FIN DE LA SECCIÓN CORREGIDA ---

    # --- NUEVO: Obtener la meta de la sucursal ---
    current_location = get_location(db, location_id)
    # BLINDAJE: Si daily_goal es None en la base de datos, usamos 0.0
    goal = 0.0
    if current_location and current_location.daily_goal is not None:
        goal = float(current_location.daily_goal)
    # ---------------------------------------------

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "daily_goal": goal, # Enviamos la meta al frontend
        "work_order_summary": work_order_summary
    }

def get_inventory_audit(db: Session, start_date: date | None = None, end_date: date | None = None, user_id: int | None = None):
    query = db.query(models.InventoryMovement).options(
        joinedload(models.InventoryMovement.product),
        joinedload(models.InventoryMovement.location),
        joinedload(models.InventoryMovement.user)
    )

    if start_date:
        query = query.filter(func.date(models.InventoryMovement.timestamp) >= start_date)
    if end_date:
        query = query.filter(func.date(models.InventoryMovement.timestamp) <= end_date)
    if user_id:
        query = query.filter(models.InventoryMovement.user_id == user_id)

    return query.order_by(models.InventoryMovement.timestamp.desc()).all()

# --- INICIO DE NUESTRO CÓDIGO (Buscador de Productos Escasos - CORREGIDO) ---
def get_low_stock_items(db: Session, user: models.User, threshold: int = 5):
    """
    Busca productos con stock igual o menor al límite.
    - Admins: Ven todo, agrupado por bodega.
    - Empleados: Ven lo de la BODEGA de su sucursal actual.
    """
    # 1. Base de la consulta: Stock + Producto + Ubicación
    query = db.query(models.Stock).join(models.Product).join(models.Location)

    # 2. Filtro de cantidad
    query = query.filter(models.Stock.quantity <= threshold)

    # 3. Filtro por Rol
    if user.role not in ["super_admin", "admin", "inventory_manager"]:
        # Si es empleado, buscamos su turno
        active_shift = get_active_shift_for_user(db, user.id)
        if not active_shift:
            return [] 
        
        # --- ARREGLO: BUSCAR LA BODEGA, NO LA OFICINA ---
        # El turno está en la "Sucursal" (ej: ID 1), pero el stock está en la "Bodega" (ej: ID 5).
        # Buscamos la bodega que pertenece a esta sucursal.
        bodega = get_primary_bodega_for_location(db, location_id=active_shift.location_id)
        
        if bodega:
            # Si encontramos bodega, filtramos por ESE id
            query = query.filter(models.Stock.location_id == bodega.id)
        else:
            # Si por alguna razón no tiene bodega (raro), no mostramos nada para evitar errores
            return []
    
    # 4. Ordenamos: Primero por Nombre de Bodega, luego por Nombre de Producto
    return query.order_by(models.Location.name, models.Product.name).all()
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Lógica de Asistencia) ---
def get_personnel_report(db: Session, start_date: date, end_date: date, user_id: int | None = None, location_id: int | None = None):
    """
    Genera un reporte de asistencia agrupado por Día y Empleado.
    Calcula horas reales trabajadas y lista las sucursales visitadas.
    """
    # 1. Consultamos los turnos (Shifts)
    query = db.query(models.Shift).join(models.User).join(models.Location)
    
    # Filtros de fecha (usamos la fecha de inicio del turno)
    query = query.filter(func.date(models.Shift.start_time) >= start_date)
    query = query.filter(func.date(models.Shift.start_time) <= end_date)
    
    if user_id:
        query = query.filter(models.Shift.user_id == user_id)
    if location_id:
        # Si filtramos por sucursal, traemos los turnos que ocurrieron en esa sucursal
        query = query.filter(models.Shift.location_id == location_id)

    # Ordenamos por usuario y luego por hora de inicio
    shifts = query.order_by(models.Shift.user_id, models.Shift.start_time).all()

    # 2. Agrupamos en memoria (Python)
    # Usaremos un diccionario donde la clave sea (user_id, fecha)
    report_data = {}

    for shift in shifts:
        # Convertimos a fecha local (simplificado: tomamos la fecha del objeto datetime)
        # Nota: Idealmente convertiríamos UTC a Local aquí, pero para efectos de agrupación
        # usaremos la fecha tal cual viene (UTC) o ajustada si usas la config de TZ.
        # Para consistencia con el dashboard, asumimos que shift.start_time viene de la BD.
        
        # Truco: Usamos la fecha del start_time.
        work_date = shift.start_time.date()
        key = (shift.user_id, work_date)

        if key not in report_data:
            report_data[key] = {
                "date": work_date,
                "user_id": shift.user.id,
                "user_email": shift.user.email,
                "user_name": shift.user.full_name or "Sin nombre",
                "first_clock_in": shift.start_time,
                "last_clock_out": shift.end_time, # Puede ser None si está activo
                "total_seconds": 0,
                "locations": set() # Usamos un set para no repetir nombres
            }
        
        # Actualizamos datos del grupo
        entry = report_data[key]
        
        # Actualizamos última salida (si este turno terminó después o sigue abierto)
        if shift.end_time:
            if entry["last_clock_out"] is None or shift.end_time > entry["last_clock_out"]:
                entry["last_clock_out"] = shift.end_time
            
            # Sumar tiempo trabajado
            duration = (shift.end_time - shift.start_time).total_seconds()
            entry["total_seconds"] += duration
        else:
            # Si el turno sigue abierto, tomamos "ahora" para calcular el parcial, 
            # o lo dejamos abierto. Para reporte, dejémoslo como "En curso".
            # Pero para first/last, si está abierto, es el último.
            entry["last_clock_out"] = None 
        
        # Agregamos la ubicación
        entry["locations"].add(shift.location.name)

    # 3. Formateamos para la respuesta
    results = []
    for key, data in report_data.items():
        total_hours = round(data["total_seconds"] / 3600, 2)
        
        results.append(schemas.DailyAttendance(
            date=data["date"],
            user_id=data["user_id"],
            user_email=data["user_email"],
            user_name=data["user_name"],
            first_clock_in=data["first_clock_in"],
            last_clock_out=data["last_clock_out"],
            total_hours=total_hours,
            locations_visited=list(data["locations"]) # Convertir set a list
        ))
    
    # Ordenar por fecha descendente
    results.sort(key=lambda x: x.date, reverse=True)
    return results
# --- FIN DE NUESTRO CÓDIGO ---


# --- INICIO DE NUESTRO CÓDIGO (Lógica de Notificaciones ACTUALIZADA) ---
def create_notification_rule(db: Session, rule: schemas.NotificationRuleCreate):
    db_rule = models.NotificationRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def update_notification_rule(db: Session, rule_id: int, rule_update: schemas.NotificationRuleCreate):
    """Permite editar una regla existente."""
    db_rule = db.query(models.NotificationRule).filter(models.NotificationRule.id == rule_id).first()
    if db_rule:
        # Actualizamos solo los campos enviados
        update_data = rule_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_rule, key, value)
        db.commit()
        db.refresh(db_rule)
    return db_rule

def get_notification_rules(db: Session):
    return db.query(models.NotificationRule).all()

def delete_notification_rule(db: Session, rule_id: int):
    db_rule = db.query(models.NotificationRule).filter(models.NotificationRule.id == rule_id).first()
    if db_rule:
        db.delete(db_rule)
        db.commit()
    return db_rule

def check_active_notifications(db: Session, user_id: int, event_type: str):
    """
    Revisa reglas para el evento dado (CLOCK_IN o SCHEDULED).
    """
    # 1. Filtro básico por tipo y activo
    rules = db.query(models.NotificationRule).filter(
        models.NotificationRule.event_type == event_type,
        models.NotificationRule.active == True
    ).all()

    applicable_rules = []
    
    # Zona Horaria Ecuador
    ecuador_tz = pytz.timezone("America/Guayaquil")
    now_ecuador = datetime.now(ecuador_tz)
    today = now_ecuador.date()
    current_time_str = now_ecuador.strftime("%H:%M") # Ej: "13:00"

    # Contamos turnos de hoy (solo si es necesario para FIRST_SHIFT)
    shifts_today_count = 0
    # Optimizamos: solo consultamos si hay alguna regla FIRST_SHIFT
    if any(r.condition == "FIRST_SHIFT" for r in rules):
         shifts_today_count = db.query(models.Shift).filter(
            models.Shift.user_id == user_id,
            func.date(models.Shift.start_time) == today
        ).count()

    for rule in rules:
        # --- LÓGICA PARA ALERTAS PROGRAMADAS (RELOJ) ---
        if event_type == "SCHEDULED":
            # Si la regla tiene horas definidas y la hora actual está en la lista
            if rule.schedule_times and current_time_str in rule.schedule_times:
                applicable_rules.append(rule)
            continue # Pasamos a la siguiente regla

        # --- LÓGICA PARA ALERTAS DE ENTRADA (CLOCK_IN) ---
        if rule.condition == "ALWAYS":
            applicable_rules.append(rule)
        
        elif rule.condition == "FIRST_SHIFT":
            # Si es la primera vez (conteo <= 1 porque acabamos de crear el turno)
            if shifts_today_count <= 1:
                applicable_rules.append(rule)

    return applicable_rules
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Lógica de Clientes) ---
def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()

def get_customer_by_id_card(db: Session, id_card: str, company_id: int):
    # Ahora buscamos la cédula PERO solo dentro de mi empresa
    return db.query(models.Customer).filter(
        models.Customer.id_card == id_card, 
        models.Customer.company_id == company_id
    ).first()

def get_customers(db: Session, company_id: int, skip: int = 0, limit: int = 100, search: str | None = None):
    # Cargamos la relación 'location' para saber el nombre de la sucursal
    query = db.query(models.Customer).filter(models.Customer.company_id == company_id).options(joinedload(models.Customer.location))
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Customer.name).like(search_term),
                func.lower(models.Customer.id_card).like(search_term)
            )
        )
    return query.order_by(models.Customer.name).offset(skip).limit(limit).all()

def create_customer(db: Session, customer: schemas.CustomerCreate, company_id: int, location_id: int | None = None):
    # 1. Validar Integridad: Verificar si la Cédula ya existe en ESTA empresa
    existing = get_customer_by_id_card(db, id_card=customer.id_card, company_id=company_id)
    if existing:
        raise ValueError(f"El cliente con Cédula/RUC {customer.id_card} ya está registrado.")

    # 2. Crear el cliente vinculado a la empresa y sucursal
    data = customer.model_dump()
    db_customer = models.Customer(**data, location_id=location_id, company_id=company_id)
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def update_customer(db: Session, customer_id: int, customer_update: schemas.CustomerCreate):
    db_customer = get_customer(db, customer_id=customer_id)
    if db_customer:
        update_data = customer_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_customer, key, value)
        db.commit()
        db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int):
    db_customer = get_customer(db, customer_id=customer_id)
    if db_customer:
        db.delete(db_customer)
        db.commit()
    return db_customer
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Lógica de Reembolsos) ---
import uuid

def process_refund(db: Session, refund: schemas.RefundCreate, user: models.User, location_id: int):
    # 1. Validar PIN del usuario que está ejecutando la acción
    if not user.hashed_pin or not security.verify_password(refund.pin, user.hashed_pin):
        raise ValueError("PIN incorrecto.")

    # 2. Buscar la venta original
    sale = get_sale(db, sale_id=refund.sale_id)
    if not sale:
        raise ValueError("Venta no encontrada.")

    # 3. Validar que el monto no exceda el total de la venta
    # (Protección extra para no devolver más de lo que se cobró)
    if refund.amount > sale.total_amount:
        raise ValueError(f"El monto a reembolsar (${refund.amount}) no puede ser mayor al total de la venta (${sale.total_amount}).")

    # 4. REGLA DE ORO: Validar Permisos para Efectivo
    if refund.type == "CASH":
        # Verificamos si el rol del usuario (del PIN ingresado) es Admin o Gerente
        # OJO: Aquí validamos al usuario LOGUEADO (user), pero el PIN ya confirmó que es él.
        # Si quisieras que un empleado llame al jefe y el jefe ponga SU pin en la sesión del empleado,
        # la lógica sería distinta. Por ahora, asumimos que el Admin debe estar logueado o
        # que el PIN corresponde al usuario activo.
        
        # AJUSTE: Si el usuario activo NO es admin, rechazamos CASH.
        if user.role not in ["super_admin", "admin", "inventory_manager"]:
            raise ValueError("⛔ PROHIBIDO: Solo un Administrador puede autorizar devoluciones de dinero. Por favor, emita una Nota de Crédito.")
        
        # Procesar salida de dinero (Gasto)
        cash_account = db.query(models.CashAccount).filter(
            models.CashAccount.location_id == location_id,
            models.CashAccount.account_type == "CAJA_VENTAS"
        ).first()
        
        if not cash_account:
            raise ValueError("No hay Caja de Ventas configurada en esta sucursal para sacar el dinero.")

        # Creamos el egreso
        transaction = models.CashTransaction(
            amount = refund.amount * -1, # Negativo porque sale dinero
            description = f"DEVOLUCIÓN EFECTIVO VENTA #{sale.id}: {refund.reason} (Aut: {user.email})",
            user_id = user.id,
            account_id = cash_account.id
        )
        db.add(transaction)
        db.commit()
        return {"status": "success", "message": "Dinero devuelto de caja exitosamente."}

    elif refund.type == "CREDIT_NOTE":
        # Los empleados SÍ pueden emitir notas de crédito
        
        # Generar Código Único (ej: NC-7F3A2B)
        code = f"NC-{str(uuid.uuid4())[:6].upper()}"
        
        # Buscar ID de cliente si existe en BD
        customer = get_customer_by_id_card(db, sale.customer_ci)
        customer_id = customer.id if customer else None

        credit_note = models.CreditNote(
            code=code,
            amount=refund.amount,
            reason=f"Devolución Venta #{sale.id}: {refund.reason}",
            user_id=user.id,
            customer_id=customer_id,
            sale_id=sale.id,
            is_active=True # Lista para usarse
        )
        db.add(credit_note)
        db.commit()
        db.refresh(credit_note)
        # Devolvemos el objeto completo para mostrar el código en pantalla
        return credit_note

    else:
        raise ValueError("Tipo de reembolso inválido.")
# --- FIN DE NUESTRO CÓDIGO ---


# --- INICIO LÓGICA CIERRE AUTOMÁTICO (CRON JOB) ---
def auto_close_all_open_shifts(db: Session):
    """
    Busca todos los turnos que siguen abiertos (end_time es NULL)
    y les pone la hora actual como hora de salida.
    """
    # 1. Buscamos los turnos abiertos
    open_shifts = db.query(models.Shift).filter(models.Shift.end_time == None).all()
    
    count = 0
    # 2. Los cerramos uno por uno con la hora actual del servidor
    now = func.now()
    for shift in open_shifts:
        shift.end_time = now
        count += 1
    
    # 3. Guardamos cambios
    db.commit()
    return count
# --- FIN LÓGICA CIERRE AUTOMÁTICO ---

# ===================================================================
# --- CONFIGURACIÓN DE EMPRESA (IDENTIDAD) ---
# ===================================================================
def get_company_settings(db: Session, company_id: int):
    """
    Obtiene la configuración DE UNA EMPRESA ESPECÍFICA.
    Si no existe para esa empresa, la crea automáticamente.
    """
    # Buscamos la configuración que tenga el company_id correcto
    settings = db.query(models.CompanySettings).filter(models.CompanySettings.company_id == company_id).first()
    
    if not settings:
        # Creamos la identidad por defecto para ESTA empresa
        settings = models.CompanySettings(
            company_id=company_id, # <--- ASIGNACIÓN IMPORTANTE
            name="Mi Empresa (Configurar)",
            ruc="9999999999001",
            address="Dirección Principal",
            phone="0999999999",
            email="info@miempresa.com"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def update_company_settings(db: Session, settings: schemas.CompanySettingsCreate, company_id: int):
    """
    Actualiza los datos de la empresa ESPECÍFICA.
    """
    # Buscamos la configuración de ESTA empresa
    db_settings = get_company_settings(db, company_id=company_id) 
    
    # Actualizamos campos
    update_data = settings.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_settings, key, value)

    db.commit()
    db.refresh(db_settings)
    return db_settings

# --- FUNCIÓN RECUPERADA ---
def update_company_distributor_status(db: Session, company_id: int, is_distributor: bool):
    """
    Enciende o apaga el letrero de 'Distribuidor' y actualiza MASIVAMENTE los productos.
    """
    # 1. Actualizar la Empresa
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company:
        company.is_distributor = is_distributor
        
        # 2. ACTUALIZACIÓN MASIVA (El Interruptor Maestro)
        # Si is_distributor es True -> Pone is_public = True a TODOS los productos.
        # Si is_distributor es False -> Pone is_public = False a TODOS los productos.
        db.query(models.Product).filter(
            models.Product.company_id == company_id
        ).update(
            {models.Product.is_public: is_distributor}, 
            synchronize_session=False # OptimizaciÃ³n para actualizaciones masivas
        )

        db.commit()
        db.refresh(company)
    return company
# --------------------------

def update_company_logo(db: Session, logo_url: str, company_id: int):
    """
    Actualiza solo el logo de la empresa ESPECÍFICA.
    """
    db_settings = get_company_settings(db, company_id=company_id)
    db_settings.logo_url = logo_url
    db.commit()
    db.refresh(db_settings)
    return db_settings


# --- Funciones para Notas de Crédito ---
def get_credit_note(db: Session, credit_note_id: int):
    return db.query(models.CreditNote).filter(models.CreditNote.id == credit_note_id).first()

def get_credit_note_by_code(db: Session, code: str):
    # Busca una nota que coincida con el código y que esté ACTIVA (no usada)
    return db.query(models.CreditNote).filter(
        models.CreditNote.code == code,
        models.CreditNote.is_active == True
    ).first()



# --- INICIO DE NUESTRO CÓDIGO (Lógica para Entregar Sin Reparación con Cobro) ---
def deliver_unrepaired_with_sale(db: Session, work_order_id: int, diagnostic_fee: float, reason: str, user_id: int, location_id: int, pin: str):
    """
    Esta función hace dos cosas de un solo golpe:
    1. Marca la orden como SIN_REPARACION.
    2. Crea una VENTA real para que el dinero aparezca en los reportes diarios.
    """
    # 1. Buscamos la orden de trabajo
    db_work_order = get_work_order(db, work_order_id=work_order_id)
    if not db_work_order:
        raise ValueError("Orden de trabajo no encontrada.")

    # 2. Actualizamos la orden
    db_work_order.status = "SIN_REPARACION"
    db_work_order.final_cost = diagnostic_fee # Guardamos cuánto se cobró al final
    
    # 3. Creamos la VENTA automática para la Caja
    # Preparamos el "ítem" de la venta (el servicio de revisión)
    revision_item = schemas.SaleItemCreate(
        product_id=None, # No es un producto físico del inventario
        description=f"REVISIÓN TÉCNICA - ORDEN #{db_work_order.id} ({db_work_order.device_model})",
        quantity=1,
        unit_price=diagnostic_fee
    )

    # Preparamos el pago (asumimos Efectivo por defecto para revisiones, o el método que prefieras)
    payment_detail = schemas.PaymentDetail(
        method="EFECTIVO",
        amount=diagnostic_fee,
        reference=reason # Ejemplo: "Cliente retiró sin reparar"
    )

    # Construimos la venta completa
    sale_create = schemas.SaleCreate(
        payment_method="EFECTIVO",
        payments=[payment_detail],
        iva_percentage=0, # Normalmente las revisiones mínimas no llevan IVA, puedes cambiarlo
        customer_ci=db_work_order.customer_id_card,
        customer_name=db_work_order.customer_name,
        customer_phone=db_work_order.customer_phone,
        customer_address=db_work_order.customer_address,
        customer_email=db_work_order.customer_email,
        items=[revision_item],
        pin=pin, # Usamos el PIN del técnico para autorizar
        work_order_id=db_work_order.id
    )

    # Llamamos a la función que ya tienes para crear ventas
    # Esto asegura que el dinero entre a la CashAccount (Caja de Ventas)
    new_sale = create_sale(db, sale_create, user_id, location_id)

    return db_work_order, new_sale
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Lógica de Arqueo de Caja DETALLADA v3) ---
def get_cash_closure_report_data(db: Session, account_id: int, closure_id: int | None = None):
    """
    Calcula totales y busca DETALLES DE PRODUCTOS para el reporte.
    """
    from datetime import datetime
    
    # 1. Definir el rango de tiempo (Igual que antes)
    if closure_id:
        target_closure = db.query(models.CashTransaction).filter(models.CashTransaction.id == closure_id).first()
        if not target_closure: raise ValueError("Cierre no encontrado")
        end_time = target_closure.timestamp
        previous_closure = db.query(models.CashTransaction).filter(
            models.CashTransaction.account_id == account_id,
            models.CashTransaction.description.like("CIERRE DE CAJA%"),
            models.CashTransaction.timestamp < end_time
        ).order_by(models.CashTransaction.timestamp.desc()).first()
        start_time = previous_closure.timestamp if previous_closure else datetime.min
    else:
        last_closure = db.query(models.CashTransaction).filter(
            models.CashTransaction.account_id == account_id,
            models.CashTransaction.description.like("CIERRE DE CAJA%")
        ).order_by(models.CashTransaction.timestamp.desc()).first()
        start_time = last_closure.timestamp if last_closure else datetime.min
        end_time = func.now()

    # 2. Obtenemos movimientos de CAJA
    transactions = db.query(models.CashTransaction).filter(
        models.CashTransaction.account_id == account_id,
        models.CashTransaction.timestamp > start_time,
        models.CashTransaction.timestamp < end_time
    ).order_by(models.CashTransaction.timestamp.asc()).all()

    summary = {
        "start_time": start_time if start_time != datetime.min else None,
        "end_time": end_time if isinstance(end_time, datetime) else datetime.now(),
        "total_cash_sales": 0.0, "total_incomes": 0.0, "total_expenses": 0.0, "final_balance": 0.0,
        "closure_amount": abs(target_closure.amount) if closure_id and target_closure else 0.0,
        "sales_list": [], "expenses_list": [], "incomes_list": []
    }

    for t in transactions:
        if "CIERRE DE CAJA" in t.description.upper(): continue

        item = { "time": t.timestamp, "description": t.description, "amount": abs(t.amount), "details": "" }

        if t.amount > 0:
            if "Venta #" in t.description or "Ingreso Venta" in t.description:
                summary["total_cash_sales"] += t.amount
                
                # --- AQUÍ ESTÁ LA MAGIA: BUSCAR DETALLES DE LA VENTA ---
                # Intentamos extraer el ID de la venta del string "Ingreso Venta #15..."
                try:
                    import re
                    match = re.search(r'Venta #(\d+)', t.description)
                    if match:
                        sale_id = int(match.group(1))
                        sale = db.query(models.Sale).options(joinedload(models.Sale.items)).filter(models.Sale.id == sale_id).first()
                        if sale:
                            # Armamos el detalle: "Cliente: Juan | Items: 1x Cargador..."
                            client_info = sale.customer_name if sale.customer_name else "Consumidor Final"
                            products_info = ", ".join([f"{i.quantity}x {i.description}" for i in sale.items])
                            item["description"] = f"Venta #{sale.id} - {client_info}" # Reemplazamos la descripción genérica
                            item["details"] = products_info # Guardamos los productos aparte
                except Exception as e:
                    print(f"No se pudo detallar venta {t.description}: {e}")
                # -------------------------------------------------------
                
                summary["sales_list"].append(item)
            else:
                summary["total_incomes"] += t.amount
                summary["incomes_list"].append(item)
        else:
            summary["total_expenses"] += abs(t.amount)
            summary["expenses_list"].append(item)

    summary["final_balance"] = summary["total_cash_sales"] + summary["total_incomes"] - summary["total_expenses"]
    if not closure_id: summary["closure_amount"] = summary["final_balance"]

    return summary
# --- FIN DE NUESTRO CÓDIGO ---

# ===================================================================
# --- MÓDULO DE GASTOS (Utilidad Neta) ---
# ===================================================================

# 1. GESTIÓN DE CATEGORÍAS (Las etiquetas del archivador)
def get_expense_categories(db: Session, company_id: int):
    """Devuelve la lista de tipos de gastos DE MI EMPRESA."""
    return db.query(models.ExpenseCategory).filter(models.ExpenseCategory.company_id == company_id).order_by(models.ExpenseCategory.name).all()

def create_expense_category(db: Session, category: schemas.ExpenseCategoryCreate, company_id: int):
    """Crea una nueva etiqueta para clasificar gastos."""
    db_category = models.ExpenseCategory(**category.model_dump(), company_id=company_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def delete_expense_category(db: Session, category_id: int):
    """Borra una categoría si fue un error."""
    db_category = db.query(models.ExpenseCategory).filter(models.ExpenseCategory.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

# 2. REGISTRO DE GASTOS (Vinculado a Cajas)
def create_expense(db: Session, expense: schemas.ExpenseCreate, user: models.User):
    """
    Registra un gasto y MUEVE EL DINERO DE LA CAJA.
    """
    # 1. Seguridad Básica (PIN)
    if not user.hashed_pin or not security.verify_password(expense.pin, user.hashed_pin):
        raise ValueError("PIN incorrecto. No tiene permiso para registrar gastos.")

    # --- SEGURIDAD BANCARIA (NUEVO) ---
    if expense.account_id:
        account = get_cash_account(db, expense.account_id)
        if not account:
            raise ValueError("La cuenta de caja seleccionada no existe.")

        # Si la cuenta es GLOBAL (location_id es None) -> Es un BANCO
        # Y el usuario NO es Admin ni Gerente...
        if account.location_id is None and user.role not in ["admin", "inventory_manager"]:
            raise ValueError("⛔ ACCESO DENEGADO: Solo Administradores pueden registrar egresos de Cuentas Bancarias Globales.")
    # ----------------------------------

    # 2. Crear el Gasto (Papel)
    expense_data = expense.model_dump(exclude={"pin"})
    db_expense = models.Expense(
        **expense_data,
        user_id=user.id,
        company_id=user.company_id # <--- El gasto se marca con la empresa del usuario
    )
    db.add(db_expense)
    db.flush() # Para obtener el ID

    # 3. MOVER EL DINERO (Crear CashTransaction)
    if expense.account_id:
        # Creamos el egreso físico del dinero
        transaction = models.CashTransaction(
            amount=expense.amount * -1, # Negativo = Salida
            description=f"GASTO #{db_expense.id}: {expense.description}",
            user_id=user.id,
            account_id=expense.account_id
        )
        db.add(transaction)

    db.commit()
    db.refresh(db_expense)
    return db_expense

def get_expenses(
    db: Session, 
    company_id: int, # <--- Nuevo parámetro obligatorio
    skip: int = 0, 
    limit: int = 100,
    start_date: date | None = None,
    end_date: date | None = None,
    location_id: int | None = None
):
    """
    Busca los gastos en el archivador DE MI EMPRESA.
    """
    # Preparamos la consulta y FILTRAMOS POR EMPRESA
    query = db.query(models.Expense).filter(models.Expense.company_id == company_id).options(
        joinedload(models.Expense.category),
        joinedload(models.Expense.user),
        joinedload(models.Expense.location)
    )

    # Filtro por Sucursal
    if location_id:
        query = query.filter(models.Expense.location_id == location_id)

    # Filtro por Fecha Inicio
    if start_date:
        query = query.filter(func.date(models.Expense.expense_date) >= start_date)

    # Filtro por Fecha Fin
    if end_date:
        query = query.filter(func.date(models.Expense.expense_date) <= end_date)

    # Ordenar: Lo más reciente primero
    return query.order_by(models.Expense.expense_date.desc()).offset(skip).limit(limit).all()

def delete_expense(db: Session, expense_id: int):
    """Elimina un gasto registrado por error."""
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if db_expense:
        db.delete(db_expense)
        db.commit()
    return db_expense
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO DE NUESTRO CÓDIGO (Lógica Financiera: El Reporte de Utilidad) ---
def generate_financial_report(
    db: Session, 
    company_id: int, # <--- Necesario para no sumar dinero ajeno
    start_date: date, 
    end_date: date, 
    location_id: int | None = None
):
    """
    Calcula la Utilidad Neta en un rango de fechas DE MI EMPRESA.
    """
    # Filtros base para fechas y EMPRESA
    date_filter_sales = and_(
        models.Sale.company_id == company_id, # <--- Filtro de empresa
        func.date(models.Sale.created_at) >= start_date,
        func.date(models.Sale.created_at) <= end_date
    )
    
    date_filter_expenses = and_(
        models.Expense.company_id == company_id, # <--- Filtro de empresa
        func.date(models.Expense.expense_date) >= start_date,
        func.date(models.Expense.expense_date) <= end_date
    )

    # Filtro opcional por sucursal
    loc_filter_sales = (models.Sale.location_id == location_id) if location_id else True
    loc_filter_expenses = (models.Expense.location_id == location_id) if location_id else True

    # 1. CALCULAR INGRESOS (REVENUE)
    # Usamos subtotal_amount porque la utilidad se calcula antes de impuestos (el IVA no es tuyo, es del estado)
    revenue = db.query(func.sum(models.Sale.subtotal_amount)).filter(
        date_filter_sales,
        loc_filter_sales
    ).scalar() or 0.0

    # 2. CALCULAR COSTO DE VENTAS (COGS - Cost of Goods Sold)
    # Sumamos (Cantidad * Costo Registrado) de cada ítem vendido en ese periodo
    cogs = db.query(
        func.sum(models.SaleItem.quantity * models.SaleItem.recorded_cost)
    ).join(models.Sale).filter(
        date_filter_sales,
        loc_filter_sales
    ).scalar() or 0.0

    # 3. CALCULAR UTILIDAD BRUTA
    gross_profit = revenue - cogs
    gross_margin_percent = (gross_profit / revenue * 100) if revenue > 0 else 0.0

    # 4. GASTOS OPERATIVOS (Suma de todo: Luz, Agua, Pasajes, etc.)
    # Aquí sumamos TODO, incluyendo los gastos de órdenes (pasajes, repuestos externos)
    total_expenses = db.query(func.sum(models.Expense.amount)).filter(
        date_filter_expenses,
        loc_filter_expenses
    ).scalar() or 0.0

    # Desglose por categoría (para el gráfico o tabla)
    breakdown_query = db.query(
        models.ExpenseCategory.name,
        func.sum(models.Expense.amount)
    ).join(models.ExpenseCategory).filter(
        date_filter_expenses,
        loc_filter_expenses
    ).group_by(models.ExpenseCategory.name).all()

    expenses_breakdown = [
        schemas.ExpenseBreakdown(category_name=cat_name, total_amount=amount)
        for cat_name, amount in breakdown_query
    ]

    # 5. CALCULAR UTILIDAD NETA FINAL
    net_utility = gross_profit - total_expenses
    net_margin_percent = (net_utility / revenue * 100) if revenue > 0 else 0.0

    return schemas.FinancialReport(
        start_date=start_date,
        end_date=end_date,
        total_revenue=round(revenue, 2),
        total_cogs=round(cogs, 2),
        gross_profit=round(gross_profit, 2),
        gross_margin_percent=round(gross_margin_percent, 2),
        total_expenses=round(total_expenses, 2),
        expenses_breakdown=expenses_breakdown,
        net_utility=round(net_utility, 2),
        net_margin_percent=round(net_margin_percent, 2)
    )

# --- NUEVO: Reporte de Productos sin Costo ---
def get_products_zero_cost(db: Session):
    """Devuelve productos activos que tienen costo promedio 0."""
    return db.query(models.Product).filter(
        models.Product.is_active == True,
        models.Product.average_cost == 0
    ).options(joinedload(models.Product.images)).all()
# ---------------------------------------------

# --- FIN DE NUESTRO CÓDIGO ---

# --- Función para obtener un movimiento completo (Corrige error 500) ---
def get_inventory_movement_by_id(db: Session, movement_id: int):
    return db.query(models.InventoryMovement).options(
        joinedload(models.InventoryMovement.product),
        joinedload(models.InventoryMovement.location),
        joinedload(models.InventoryMovement.user)
    ).filter(models.InventoryMovement.id == movement_id).first()
# -----------------------------------------------------------------------

def get_top_sellers(db: Session, company_id: int, start_date: date, end_date: date):
    return db.query(
        models.User, 
        func.sum(models.Sale.total_amount).label("total_sales")
    ).join(models.Sale).filter(
        models.Sale.company_id == company_id,
        func.date(models.Sale.created_at) >= start_date,
        func.date(models.Sale.created_at) <= end_date
    ).group_by(models.User.id).order_by(desc("total_sales")).limit(5).all()

# ===================================================================
# --- TRANSFERENCIAS ENTRE SUCURSALES (MOVIMIENTO DE MERCADERÍA) ---
# ===================================================================

def get_transfers(
    db: Session,
    company_id: int,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    location_id: int | None = None,
    force_filter: bool = False # <--- NUEVO PARÁMETRO DE SEGURIDAD
):
    """
    Lista los envíos de mercadería.
    - location_id: ID de la bodega para filtrar.
    - force_filter: Si es True y no hay location_id, devuelve lista vacía (seguridad para empleados).
    """
    # Si se exige filtro pero no hay ID (ej: empleado sin turno), no mostramos nada.
    if force_filter and not location_id:
        return []

    query = db.query(models.Transfer).filter(models.Transfer.company_id == company_id)

    if status:
        query = query.filter(models.Transfer.status == status)
    
    if location_id:
        # Filtro Inteligente: Muestra si soy el Remitente O el Destinatario
        query = query.filter(
            or_(
                models.Transfer.source_location_id == location_id,
                models.Transfer.destination_location_id == location_id
            )
        )

    return query.order_by(models.Transfer.created_at.desc()).offset(skip).limit(limit).all()

def get_transfer(db: Session, transfer_id: int):
    """Obtiene el detalle completo de un envío (con productos y nombres)."""
    return db.query(models.Transfer).options(
        joinedload(models.Transfer.items).joinedload(models.TransferItem.product),
        joinedload(models.Transfer.source_location),
        joinedload(models.Transfer.destination_location),
        joinedload(models.Transfer.created_by),
        joinedload(models.Transfer.received_by)
    ).filter(models.Transfer.id == transfer_id).first()

def create_transfer(db: Session, transfer_in: schemas.TransferCreate, user: models.User, location_id: int):
    """
    Crea un envío y RESTA el stock de la bodega de origen.
    Asegura que el origen y destino sean BODEGAS (Sub-ubicaciones).
    """
    # 1. Validar PIN del que envía
    if not user.hashed_pin or not security.verify_password(transfer_in.pin, user.hashed_pin):
        raise ValueError("PIN incorrecto.")

    # [MEJORA] Determinar ID de Origen:
    # Si viene explícito en el JSON (caso Admin sin turno), usamos ese.
    # Si no, usamos el location_id del contexto (caso Empleado con turno).
    origin_id_to_use = transfer_in.source_location_id if transfer_in.source_location_id else location_id

    # 2. Determinar Bodega de Origen (Donde se resta el stock)
    # Buscamos si la ubicación de origen tiene una Bodega hija
    source_bodega = get_primary_bodega_for_location(db, location_id=origin_id_to_use)
    
    # Si no encontramos bodega hija, asumimos que la ubicación YA ES la bodega
    if not source_bodega:
        current_loc = get_location(db, location_id=origin_id_to_use)
        if current_loc:
             source_bodega = current_loc
        else:
             raise ValueError(f"No se pudo determinar el origen de stock para la ubicación {origin_id_to_use}.")

    # 3. Determinar Bodega de Destino (A donde llegará el stock)
    dest_bodega = get_primary_bodega_for_location(db, transfer_in.destination_location_id)
    
    if not dest_bodega:
        # Si el destino no tiene hijos, tal vez es una bodega directa
        dest_loc = get_location(db, transfer_in.destination_location_id)
        if dest_loc: 
             dest_bodega = dest_loc
        else:
             raise ValueError("La sucursal de destino no es válida.")

    if source_bodega.id == dest_bodega.id:
        raise ValueError("El origen y el destino no pueden ser iguales.")

    # 4. Crear la 'Guía de Remisión' (Cabecera) usando los IDs de las BODEGAS
    db_transfer = models.Transfer(
        company_id=user.company_id,
        source_location_id=source_bodega.id,      # <--- ID REAL DE LA BODEGA
        destination_location_id=dest_bodega.id,   # <--- ID REAL DE LA BODEGA
        status="PENDIENTE",
        note=transfer_in.note,
        created_by_id=user.id
    )
    db.add(db_transfer)
    db.flush() 

    # 5. Procesar cada producto (Items)
    for item in transfer_in.items:
        # A. Verificar si hay stock suficiente en la BODEGA DE ORIGEN
        stock_entry = db.query(models.Stock).filter(
            models.Stock.product_id == item.product_id,
            models.Stock.location_id == source_bodega.id # <--- BUSCAMOS EN LA BODEGA
        ).with_for_update().first() 

        current_qty = stock_entry.quantity if stock_entry else 0
        
        if current_qty < item.quantity:
            product = get_product(db, item.product_id)
            # Mensaje de error DETALLADO para depuración
            raise ValueError(f"Stock insuficiente de '{product.name}' en '{source_bodega.name}' (ID: {source_bodega.id}). Hay {current_qty}, intentas enviar {item.quantity}.")

        # B. Registrar el item en la guía
        db_item = models.TransferItem(
            transfer_id=db_transfer.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(db_item)

        # C. RESTAR del Inventario Origen (Usando el ID de la Bodega)
        movement = schemas.InventoryMovementCreate(
            product_id=item.product_id,
            location_id=source_bodega.id,  # <--- RESTA DE LA BODEGA
            quantity_change=-item.quantity, 
            movement_type="TRANSFERENCIA_SALIDA",
            reference_id=f"ENVIO-{db_transfer.id}",
            pin=transfer_in.pin
        )
        create_inventory_movement(db, movement, user.id)

    db.commit()
    db.refresh(db_transfer)
    return db_transfer

def receive_transfer(db: Session, transfer_id: int, receive_data: schemas.TransferReceive, user: models.User):
    """
    Procesa la recepción de mercadería con COTEJO DETALLADO.
    - Actualiza lo que realmente llegó.
    - Suma al stock de destino SOLO la cantidad recibida.
    """
    # 1. Validar PIN
    if not user.hashed_pin or not security.verify_password(receive_data.pin, user.hashed_pin):
        raise ValueError("PIN incorrecto.")

    # 2. Buscar el envío
    transfer = get_transfer(db, transfer_id)
    if not transfer:
        raise ValueError("Envío no encontrado.")
    
    if transfer.status != "PENDIENTE":
        raise ValueError(f"Este envío ya fue procesado ({transfer.status}).")

    # 3. Procesar Acción
    if receive_data.status in ["ACEPTADO", "ACEPTADO_PARCIAL"]:
        # Si hay lista detallada de recepción (Checklist)
        if receive_data.items:
            # Convertimos la lista recibida a un diccionario para búsqueda rápida {item_id: data}
            received_map = {item.item_id: item for item in receive_data.items}

            for db_item in transfer.items:
                # Buscamos qué dijo el usuario sobre este item específico
                rec_info = received_map.get(db_item.id)
                
                # Cantidad a sumar: Lo que dijo el usuario, o 0 si no dijo nada
                qty_to_add = rec_info.received_quantity if rec_info else 0
                note_to_add = rec_info.note if rec_info else None

                # Guardamos la evidencia en la base de datos
                db_item.received_quantity = qty_to_add
                db_item.reception_note = note_to_add

                # --- MOVIMIENTO DE INVENTARIO (ENTRADA) ---
                # Solo si llegó algo (qty > 0)
                if qty_to_add > 0:
                    movement = schemas.InventoryMovementCreate(
                        product_id=db_item.product_id,
                        location_id=transfer.destination_location_id,
                        quantity_change=qty_to_add, # Positivo = Entrada
                        movement_type="TRANSFERENCIA_ENTRADA",
                        reference_id=f"RECIBO-{transfer.id}",
                        pin=receive_data.pin
                    )
                    create_inventory_movement(db, movement, user.id)
        
        # Si NO mandaron lista (compatibilidad antigua), aceptamos todo lo enviado
        else:
            for item in transfer.items:
                item.received_quantity = item.quantity # Asumimos llegó todo
                movement = schemas.InventoryMovementCreate(
                    product_id=item.product_id,
                    location_id=transfer.destination_location_id,
                    quantity_change=item.quantity,
                    movement_type="TRANSFERENCIA_ENTRADA",
                    reference_id=f"RECIBO-{transfer.id}",
                    pin=receive_data.pin
                )
                create_inventory_movement(db, movement, user.id)

        transfer.status = receive_data.status # "ACEPTADO" o "ACEPTADO_PARCIAL"
    
    elif receive_data.status == "RECHAZADO":
        # --- RECHAZAR: Todo vuelve al origen ---
        for item in transfer.items:
            movement = schemas.InventoryMovementCreate(
                product_id=item.product_id,
                location_id=transfer.source_location_id, # Vuelve a casa
                quantity_change=item.quantity, 
                movement_type="TRANSFERENCIA_DEVUELTA",
                reference_id=f"RECHAZO-{transfer.id}",
                pin=receive_data.pin
            )
            create_inventory_movement(db, movement, user.id)
        
        transfer.status = "RECHAZADO"
        
    else:
        raise ValueError("Estado inválido.")

    # 4. Firma y Fecha
    if receive_data.note:
        transfer.note = (transfer.note or "") + f" | Nota Recepción: {receive_data.note}"

    transfer.received_by_id = user.id
    transfer.updated_at = func.now()
    
    db.commit()
    db.refresh(transfer)
    return transfer

# ===================================================================
# --- HERRAMIENTAS DE MANTENIMIENTO ---
# ===================================================================
def repair_location_hierarchy(db: Session, company_id: int):
    """
    Función de Mantenimiento:
    Escanea todas las ubicaciones. Si encuentra una "Bodega - X" y existe "X",
    las vincula oficialmente en la base de datos (establece parent_id).
    """
    # 1. Obtener todas las ubicaciones de la empresa
    locations = db.query(models.Location).filter(models.Location.company_id == company_id).all()
    
    # Mapa de Nombre -> ID para búsqueda rápida (ej: "MATRIZ": 3)
    loc_map = {loc.name.strip().upper(): loc for loc in locations}
    
    updates_count = 0
    
    for loc in locations:
        # Si la ubicación ya tiene padre, la saltamos (ya está correcta)
        if loc.parent_id:
            continue
            
        name_upper = loc.name.strip().upper()
        
        # Detectar si es una Bodega Huérfana (empieza con "BODEGA - ")
        if name_upper.startswith("BODEGA -"):
            # Extraemos el nombre del presunto padre
            # Ej: "BODEGA - MATRIZ NUEVA AURORA" -> "MATRIZ NUEVA AURORA"
            potential_parent_name = name_upper.replace("BODEGA -", "").strip()
            
            # Buscamos al padre en el mapa
            parent = loc_map.get(potential_parent_name)
            
            if parent:
                # ¡Encontramos a la familia! Hacemos el vínculo oficial.
                print(f"🔧 REPARANDO: Vinculando '{loc.name}' como hijo de '{parent.name}'")
                loc.parent_id = parent.id
                updates_count += 1
    
    if updates_count > 0:
        db.commit()
        print(f"✅ Se repararon {updates_count} relaciones de jerarquía.")
    else:
        print("👌 La jerarquía de ubicaciones parece correcta.")
        
    return updates_count

# ===================================================================
# --- SUPER ADMIN (GESTIÓN DE TALLERES Y SAAS) ---
# ===================================================================

def saas_get_all_companies(db: Session):
    """
    Super Admin: Obtiene empresas, cuenta empleados y busca al Dueño.
    """
    results = db.query(
        models.Company,
        func.count(models.User.id).label("user_count")
    ).outerjoin(models.User, models.User.company_id == models.Company.id)\
     .group_by(models.Company.id)\
     .order_by(models.Company.id.desc()).all()
    
    companies_list = []
    for company, user_count in results:
        comp_dict = company.__dict__.copy()
        comp_dict["user_count"] = user_count
        
        if not hasattr(company, "modules") or company.modules is None:
             comp_dict["modules"] = {
                 "inventory": True, "pos": True, "work_orders": True, "expenses": True
             }

        # --- RAYOS X: Buscar datos de contacto y dueño ---
        # 1. Configuración (Teléfono/Dirección/RUC/Nombre Comercial)
        settings = db.query(models.CompanySettings).filter(models.CompanySettings.company_id == company.id).first()
        comp_dict["contact_phone"] = settings.phone if settings else "No registrado"
        comp_dict["contact_address"] = settings.address if settings else "No registrada"
        
        # --- NUEVO: Extraemos RUC y Nombre Comercial para el Buscador ---
        comp_dict["contact_ruc"] = settings.ruc if settings else "No registrado"
        # Si tiene nombre comercial en settings, lo usamos. Si no, usamos el de registro.
        comp_dict["commercial_name"] = settings.name if (settings and settings.name) else company.name 
        # ---------------------------------------------------------------

        # 2. Dueño (Primer Admin encontrado)
        admin = db.query(models.User).filter(
            models.User.company_id == company.id, 
            models.User.role == 'admin'
        ).order_by(models.User.id.asc()).first()
        
        comp_dict["admin_email"] = admin.email if admin else "Sin Admin"
        comp_dict["admin_name"] = admin.full_name if (admin and admin.full_name) else "Sin Nombre"
        # -----------------------------------------------
        
        companies_list.append(comp_dict)
        
    return companies_list

def saas_get_company_users(db: Session, company_id: int):
    """Obtiene toda la nómina de una empresa."""
    return db.query(models.User).filter(models.User.company_id == company_id).all()

def saas_toggle_user_status(db: Session, user_id: int, is_active: bool):
    """Bloquea o desbloquea a un usuario específico."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise ValueError("Usuario no encontrado")
    
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user

def saas_toggle_company_status(db: Session, company_id: int, is_active: bool):
    """
    Activa o Bloquea una empresa entera (El botón de 'PAGAME').
    """
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise ValueError("Empresa no encontrada")
    
    company.is_active = is_active
    db.commit()
    db.refresh(company)
    return company

def saas_update_company_modules(db: Session, company_id: int, modules_config: dict):
    """
    Activa o desactiva módulos específicos (POS, Taller, etc.).
    """
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise ValueError("Empresa no encontrada")
    
    # IMPORTANTE: Asumimos que el modelo Company tiene una columna 'modules' (JSON).
    # Si no la tiene, esto dará error hasta que actualicemos models.py, 
    # pero preparamos el terreno.
    
    # Actualizamos el JSON
    # Si ya tenía configuración, la mezclamos con la nueva.
    current_modules = dict(company.modules) if (hasattr(company, "modules") and company.modules) else {}
    current_modules.update(modules_config)
    
    company.modules = current_modules
    
    # Forzamos a SQLAlchemy a detectar el cambio en el JSON
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(company, "modules")
    
    db.commit()
    db.refresh(company)
    return company


# --- NUEVO: FUNCIÓN DE ENTREGA DE LLAVES (INVITACIÓN SUPER ADMIN) ---
def saas_create_company_invitation(db: Session, company_id: int, email: str, role: str, super_admin_user: models.User):
    """
    Permite al Super Admin invitar a un usuario a CUALQUIER empresa.
    Ideal para entregar el dominio a un nuevo dueño.
    """
    # 1. Verificamos que la empresa exista
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise ValueError("La empresa especificada no existe.")

    # 2. Verificamos si el correo ya es usuario
    if get_user_by_email(db, email):
        raise ValueError("Este correo ya está registrado como usuario activo.")

    # 3. Creamos la invitación reutilizando la lógica existente, 
    # PERO forzamos el company_id del destino (no el del super admin)
    
    # Generar Token único
    token = str(uuid.uuid4())
    expiration = datetime.now(pytz.utc) + timedelta(hours=48)

    db_invitation = models.UserInvitation(
        email=email,
        role=role,
        token=token,
        expires_at=expiration,
        company_id=company.id, # <--- AQUÍ ESTÁ LA MAGIA: Asignamos la empresa destino
        created_by_id=super_admin_user.id
    )
    db.add(db_invitation)
    db.flush()

    # --- ENVIAR CORREO PERSONALIZADO ---
    try:
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "programador.ecu@gmail.com" # Tu correo
        sender_password = "sjvg bgag xdkp zlaa"    # Tu clave
        
        # Link al frontend
        invite_link = f"http://localhost:5173/accept-invite?token={token}"

        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = email
        msg['Subject'] = f"Reclama el dominio de {company.name} - Repara Xpress"

        # Mensaje con tono de PROPIEDAD
        body = f"""
        Hola,
        
        Se ha generado un enlace de acceso exclusivo para que tomes el control total y permanente de:
        
        Empresa: {company.name}
        Rol Asignado: {role.upper()} (Propietario/Gerente)
        
        Haz clic en el siguiente enlace para configurar tus credenciales de acceso y tomar posesión inmediata:
        
        {invite_link}
        
        Este enlace es personal e intransferible. Caduca en 48 horas por seguridad.
        """
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, email, msg.as_string())
        server.quit()
        
        print(f"✅ Llaves enviadas a {email}")
        
    except Exception as e:
        print(f"❌ Error enviando correo: {e}")
        print(f"🔗 LINK RESPALDO: {invite_link}")

    db.commit()
    db.refresh(db_invitation)
    return db_invitation


# --- NUEVO: REGISTRAR PAGO Y EXTENDER SERVICIO ---
def saas_register_payment(db: Session, company_id: int, months: int, plan_type: str):
    """
    Registra un pago y extiende la fecha de vencimiento.
    - Si ya estaba vencido, cuenta desde HOY.
    - Si no estaba vencido, suma tiempo a la fecha existente.
    """
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise ValueError("Empresa no encontrada")

    now = datetime.now(pytz.utc)
    
    # 1. Determinar desde cuándo sumar
    # Si no tenía fecha o ya pasó, empezamos desde hoy.
    # Si tiene fecha futura, sumamos a partir de esa fecha.
    start_date = now
    if company.next_payment_due and company.next_payment_due > now:
        start_date = company.next_payment_due
    
    # 2. Calcular nueva fecha (+30 días por mes aprox)
    # Usamos 30 días para simplificar, o relativedelta si quieres exactitud de calendario
    days_to_add = months * 30 
    new_due_date = start_date + timedelta(days=days_to_add)

    # 3. Actualizar datos
    company.next_payment_due = new_due_date
    company.last_payment_date = now
    company.plan_type = plan_type
    company.is_active = True # Si paga, se activa automáticamente
    
    # Activamos los módulos "PRO" por defecto al pagar
    if not company.modules:
        company.modules = {"inventory": True, "pos": True, "work_orders": True, "expenses": True}
    else:
        # Aseguramos que los módulos estén activos
        # (Aquí podrías ser más selectivo, pero por ahora activamos todo)
        current = dict(company.modules)
        current.update({"pos": True, "work_orders": True, "expenses": True})
        company.modules = current
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(company, "modules")

    db.commit()
    db.refresh(company)
    return company
# -------------------------------------------------