
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.sql import func, and_, case, literal_column, or_, text
from sqlalchemy.orm import Session, joinedload, outerjoin, selectinload
from datetime import date, datetime # Añadimos datetime
import pytz # Añadimos pytz para la zona horaria
from decimal import Decimal
from app.utils.money import money, calc_tax, calc_total

import os

from . import models, schemas, security

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

def get_products(db: Session, skip: int = 0, limit: int = 100, search: str | None = None, location_id: int | None = None):
    # --- Parte 1: Encontrar los productos que coinciden y su stock local ---
    base_query = db.query(
        models.Product,
        models.Category.name.label("category_name")
    ).outerjoin(models.Category, models.Product.category_id == models.Category.id)\
     .options(joinedload(models.Product.images)) # Cargar imágenes

    current_bodega_id = None
    if location_id:
        bodega = get_primary_bodega_for_location(db, location_id=location_id)
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
             # Si no hay bodega local, añadir columna como 0
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
            (func.lower(models.Product.name).like(search_term)) |
            (func.lower(models.Product.sku).like(search_term)) |
            (func.lower(models.Product.description).like(search_term))
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

        # Añadir stock local (ya viene en 'row')
        product_data['stock_quantity'] = row.stock_quantity if row.stock_quantity is not None else 0

        # Añadir stock de otras ubicaciones (buscando en el diccionario que creamos)
        product_data['other_locations_stock'] = other_stock_data.get(row.Product.id, []) # Usa .get() para default a lista vacía

        # Validar con el schema Pydantic
        products_list.append(schemas.Product.model_validate(product_data))

    return products_list

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

def get_locations(db: Session, skip: int = 0, limit: int = 100):
    # --- INICIO DE NUESTRO CÓDIGO (Mostrar solo Sucursales, no Bodegas) ---
    # Filtramos para que solo muestre locaciones SIN 'parent_id' (es decir, las oficinas)
    return db.query(models.Location)\
        .filter(models.Location.parent_id == None)\
        .order_by(models.Location.name)\
        .offset(skip).limit(limit).all()
    # --- FIN DE NUESTRO CÓDIGO ---

def create_location(db: Session, location: schemas.LocationCreate):
    # --- INICIO DE NUESTRO CÓDIGO (La "Magia 3-en-1") ---
    
    # 1. Creamos la "Oficina Principal" (La Sucursal)
    sucursal_data = location.model_dump()
    sucursal_data['parent_id'] = None 
    
    db_sucursal = models.Location(**sucursal_data)
    db.add(db_sucursal)
    
    # 2. Hacemos un "pre-guardado" para que la base de datos nos dé el ID
    db.flush() 

    # 3. Creamos el "Cuarto de Almacenamiento" (La Bodega)
    db_bodega = models.Location(
        name=f"Bodega - {db_sucursal.name}", 
        description=f"Almacén en {db_sucursal.name}",
        address=db_sucursal.address, 
        parent_id=db_sucursal.id 
    )
    db.add(db_bodega)
    
    # 4. Creamos la "Caja Fuerte de Ventas" (CashAccount)
    db_caja_ventas = models.CashAccount(
        name=f"Caja Ventas - {db_sucursal.name}",
        account_type="CAJA_VENTAS", # Usamos el nuevo tipo
        location_id=db_sucursal.id # La conectamos a la Oficina
    )
    db.add(db_caja_ventas)

    # 5. Guardamos todo (Oficina, Bodega y Caja Fuerte)
    db.commit()
    
    # 6. Devolvemos la "Oficina Principal" al usuario
    db.refresh(db_sucursal)
    return db_sucursal
    # --- FIN DE NUESTRO CÓDIGO ---

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
    return db.query(models.Location).filter(models.Location.parent_id == location_id).first()

# --- INICIO DE NUESTRO CÓDIGO (Lista solo de Bodegas) ---
def get_bodegas(db: Session, skip: int = 0, limit: int = 100):
    """
    Devuelve una lista de TODAS las bodegas (cuartos de almacenamiento).
    Filtra solo las locaciones que SÍ tienen un parent_id.
    """
    # Esta es la regla del "plomero": "tráeme solo los cuartos con parent_id"
    return db.query(models.Location)\
        .filter(models.Location.parent_id != None)\
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

    if quantity_change == 0:
        return None # No hay nada que hacer

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
        # Solo permitir crear si la cantidad es positiva (entrada/ajuste)
        if movement.quantity_change <= 0:
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

# ===================================================================
# --- USUARIOS Y SEGURIDAD ---
# ===================================================================
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).order_by(models.User.id).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    # --- INICIO DE NUESTRO CÓDIGO (RRHH: Crear empleado/gerente) ---
    hashed_password = security.get_password_hash(user.password)
    
    # Preparamos al usuario con los datos del formulario "Crear"
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        is_active=True  # Activamos el usuario por defecto
        # (El PIN se deja en None a propósito, para que el usuario lo cree)
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
    # --- FIN DE NUESTRO CÓDIGO ---

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
    return (
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



def get_work_orders(db: Session, user: models.User, skip: int = 0, limit: int = 100):
    """
    Obtiene las órdenes de trabajo con lógica de permisos.
    - Admins/Managers ven todas las órdenes.
    - Otros roles solo ven las de su turno activo.
    """
    # Preparamos la consulta base, incluyendo los datos del usuario y la ubicación.
    query = db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    )

    # --- LÓGICA DE PERMISOS ---
    # Si el rol del usuario NO es 'admin' o 'inventory_manager'...
    if user.role not in ["admin", "inventory_manager"]:
        # ...buscamos su turno activo para saber dónde está trabajando.
        active_shift = get_active_shift_for_user(db, user_id=user.id)

        # Si no tiene un turno activo, no puede ver ninguna orden.
        if not active_shift:
            return [] # Le devolvemos una lista vacía.

        # Filtramos la búsqueda para que SOLO devuelva órdenes de su sucursal actual.
        query = query.filter(models.WorkOrder.location_id == active_shift.location_id)

    # Finalmente, ordenamos las órdenes de la más nueva a la más antigua y las devolvemos.
    return query.order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

def create_work_order(db: Session, work_order: schemas.WorkOrderCreate, user_id: int, location_id: int):
    # 1. Crear la Orden de Trabajo básica
    work_order_data = work_order.model_dump(exclude={"pin", "deposit_payment_method"})
    db_work_order = models.WorkOrder(**work_order_data, user_id=user_id, location_id=location_id)
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
            reference="Adelanto Automático"
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
    """
    Busca órdenes de trabajo con estado 'LISTO' visibles para el usuario actual.
    Permite filtrar por número de orden (ID), nombre de cliente o cédula.
    """
    # Consulta base, incluyendo usuario y ubicación
    query = db.query(models.WorkOrder).options(
        joinedload(models.WorkOrder.user),
        joinedload(models.WorkOrder.location)
    ).filter(models.WorkOrder.status == 'LISTO') # <-- SOLO ÓRDENES LISTAS

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
# --- INICIO DE NUESTRO CÓDIGO (Venta con Pagos Mixtos) ---
def create_sale(db: Session, sale: schemas.SaleCreate, user_id: int, location_id: int):
    try:
        bodega = get_primary_bodega_for_location(db, location_id=location_id)
        if not bodega:
            raise ValueError(f"La sucursal con ID {location_id} no tiene una bodega configurada.")

        if not sale.items:
            raise ValueError("La venta debe incluir al menos un ítem.")
        
        # --- INICIO LÓGICA CLIENTE INTELIGENTE ---
        # 1. Buscamos si el cliente ya existe por su cédula
        existing_customer = get_customer_by_id_card(db, id_card=sale.customer_ci)
        
        if existing_customer:
            # 2. Si existe, ACTUALIZAMOS sus datos (por si cambió de teléfono o dirección)
            existing_customer.name = sale.customer_name
            existing_customer.phone = sale.customer_phone
            existing_customer.email = sale.customer_email
            existing_customer.address = sale.customer_address
        else:
            # 3. Si NO existe, lo CREAMOS automáticamente
            new_customer = models.Customer(
                id_card=sale.customer_ci,
                name=sale.customer_name,
                phone=sale.customer_phone,
                email=sale.customer_email,
                address=sale.customer_address,
                # Guardamos la sucursal donde se hizo la primera compra
                location_id=location_id, 
                notes="Cliente registrado automáticamente desde Venta"
            )
            db.add(new_customer)
        # --- FIN LÓGICA CLIENTE INTELIGENTE ---

        # --- LÓGICA DE RECIBO LEGAL (CORRECCIÓN TOTALES) ---
        # Si estamos cobrando el saldo final de una reparación, re-calculamos la venta
        # para que refleje el TOTAL ($25) y muestre el abono ($5) como pago previo.
        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            # Solo aplicamos si existe abono previo
            if db_work_order and (db_work_order.deposit_amount or 0) > 0:
                # Calculamos cuánto falta por pagar (Saldo = Total - Abono)
                real_total = db_work_order.final_cost if db_work_order.final_cost is not None else db_work_order.estimated_cost
                pending_balance = real_total - db_work_order.deposit_amount
                
                # Calculamos cuánto está pagando el cliente AHORA
                amount_paying_now = sum(p.amount for p in sale.payments)

                # TRUCO: Solo activamos esta lógica si el cliente está pagando el SALDO COMPLETO (o casi)
                # Si es solo el depósito inicial ($5), esta condición falla y no hace nada (correcto).
                if abs(amount_paying_now - pending_balance) < 0.02:
                    
                    # 1. Ajustamos el ítem de venta para que cueste el TOTAL ($25)
                    if sale.items:
                        sale.items[0].unit_price = real_total
                        # sale.items[0].description += " (Valor Total)"

                    # 2. Reconstruimos los pagos: [Anticipo: $5] + [Efectivo: $20]
                    # Asumimos que el método de hoy es el que envió el frontend (ej: EFECTIVO)
                    current_method = sale.payments[0].method if sale.payments else "EFECTIVO"
                    
                    new_payments = []
                    # Agregamos el Anticipo
                    new_payments.append(schemas.PaymentDetail(
                        method="ANTICIPO",
                        amount=db_work_order.deposit_amount,
                        reference="Abono previo"
                    ))
                    # Agregamos el Pago de Hoy
                    new_payments.append(schemas.PaymentDetail(
                        method=current_method,
                        amount=amount_paying_now,
                        reference="Cancelación de saldo"
                    ))
                    
                    sale.payments = new_payments
                    sale.payment_method = "MIXTO" # Forzamos mixto para que el PDF detalle ambos
        # ---------------------------------------------------

        # 1. Calcular totales de productos
        subtotal_decimal = Decimal("0.00")
        sale_items_to_create = []
        for item in sale.items:
            line_total_decimal = Decimal(item.quantity) * Decimal(str(item.unit_price))
            subtotal_decimal += line_total_decimal
            line_total = line_total_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            sale_items_to_create.append(
                models.SaleItem(
                    **item.model_dump(),
                    line_total=float(line_total)
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
        # Usamos una pequeña tolerancia por decimales
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
            payment_method_details=payment_details_json, # Guardamos la lista aquí
            
            customer_ci=sale.customer_ci,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            customer_address=sale.customer_address,
            customer_email=sale.customer_email,

            # --- NUEVO: GUARDAR GARANTÍA ---
            warranty_terms=sale.warranty_terms,
            # -------------------------------

            user_id=user_id,
            location_id=location_id,
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

        # 6. Procesar Pagos (Caja y Notas de Crédito)
        db_caja_ventas = db.query(models.CashAccount).filter(
            models.CashAccount.location_id == location_id,
            models.CashAccount.account_type == "CAJA_VENTAS"
        ).first()

        for payment in sale.payments:
            # --- CASO 1: EFECTIVO (Entra dinero a caja) ---
            if payment.method == "EFECTIVO":
                if db_caja_ventas:
                    db_transaction = models.CashTransaction(
                        amount=payment.amount,
                        description=f"Ingreso Venta #{db_sale.id} (Parte en Efectivo)",
                        user_id=user_id,
                        account_id=db_caja_ventas.id
                    )
                    db.add(db_transaction)
            
            # --- CASO 2: NOTA DE CRÉDITO (Se quema el vale) ---
            elif payment.method == "CREDIT_NOTE":
                # La referencia DEBE ser el código de la nota (ej: NC-1234)
                note_code = payment.reference
                if not note_code:
                    raise ValueError("Se requiere el código de la Nota de Crédito.")
                
                # Buscamos la nota y bloqueamos la fila para evitar doble uso simultáneo
                credit_note = db.query(models.CreditNote).filter(
                    models.CreditNote.code == note_code,
                    models.CreditNote.is_active == True
                ).with_for_update().first()

                if not credit_note:
                    raise ValueError(f"La Nota de Crédito '{note_code}' no existe o ya fue utilizada.")
                
                # Verificamos fondos
                # Permitimos usar una nota de $50 para pagar $20? Sí.
                # ¿Qué pasa con el vuelto? Por simplicidad en V1, asumimos uso total o exacto.
                # Si la nota es de $50 y la venta es de $50, perfecto.
                # Si la nota es menor, el cliente paga la diferencia.
                # Si la nota es mayor... el sistema actual quemará la nota entera. 
                # (Idealmente se emitiría una nueva nota por el cambio, pero por ahora simplifiquemos).
                if credit_note.amount < (payment.amount - 0.02): # Pequeña tolerancia
                     raise ValueError(f"La Nota de Crédito tiene ${credit_note.amount}, pero intentas cobrar ${payment.amount}.")

                # QUEMAMOS LA NOTA (Ya no sirve)
                credit_note.is_active = False
                credit_note.reason += f" (Usada en Venta #{db_sale.id})"

        # 7. Actualizar Orden de Trabajo (si aplica)
        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            if db_work_order:
                # --- CORRECCIÓN: NO marcar entregado si es solo un adelanto parcial ---
                
                # 1. Calculamos cuánto faltaba por pagar (Saldo Teórico)
                #    (Costo Total - Lo que ya tenía anotado como abono)
                pending_balance = db_work_order.estimated_cost - db_work_order.deposit_amount
                
                # 2. Verificamos si ESTA venta cubre ese saldo restante.
                #    Usamos un margen de 0.02 para evitar errores de decimales.
                #    Si (Venta >= Saldo Pendiente), entonces completó el pago.
                if subtotal_amount >= (pending_balance - 0.02):
                    # --- CORRECCIÓN DE REGLA DE NEGOCIO ---
                    # Solo marcamos como ENTREGADO si el equipo ya estaba LISTO.
                    # Si el equipo apenas está RECIBIDO o REPARANDO, y el cliente paga por adelantado,
                    # NO debemos cambiar el estado a ENTREGADO todavía.
                    if db_work_order.status == "LISTO":
                        db_work_order.status = "ENTREGADO"
                        db_work_order.final_cost = db_work_order.estimated_cost
                    # Si no estaba LISTO, simplemente se registra el pago y el saldo baja a 0,
                    # pero el estado se mantiene (ej: REPARANDO).
                    # --------------------------------------
                
                # Si la venta es menor al saldo (ej: Abono de $10 para una deuda de $30),
                # NO hacemos nada con el estado. La orden sigue abierta.

        db.commit()
        db.refresh(db_sale)
        return db_sale

    except ValueError as e:
        db.rollback()
        raise Exception(str(e))
    except Exception as e:
        db.rollback()
        raise e
# --- FIN DE NUESTRO CÓDIGO ---


def get_sale(db: Session, sale_id: int):
    return (
        db.query(models.Sale)
        .options(
            joinedload(models.Sale.user),
            joinedload(models.Sale.location),
            joinedload(models.Sale.items).joinedload(models.SaleItem.product),
        )
        .filter(models.Sale.id == sale_id)
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
    if user.role in ["admin", "inventory_manager"]:
        # Si es Admin o Gerente, PUEDE filtrar por sucursal.
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

    # 6. Devolvemos la lista filtrada, de la más nueva a la más vieja
    return query.order_by(models.Sale.created_at.desc()).offset(skip).limit(limit).all()
# --- FIN DE NUESTRO CÓDIGO ---


# ===================================================================
# --- GESTIÓN DE CAJA ---
# ===================================================================
def create_cash_account(db: Session, account: schemas.CashAccountCreate):
    # Convertimos el nombre a MAYÚSCULAS antes de guardar
    account_data = account.model_dump()
    account_data['name'] = account_data['name'].upper()
    
    db_account = models.CashAccount(**account_data)
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
    # CORRECCIÓN: Leemos la zona horaria del sistema, no la ponemos a fuego.
    app_timezone = os.getenv("TZ", "America/Guayaquil")

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

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
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
    if user.role not in ["admin", "inventory_manager"]:
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

def get_customer_by_id_card(db: Session, id_card: str):
    return db.query(models.Customer).filter(models.Customer.id_card == id_card).first()

def get_customers(db: Session, skip: int = 0, limit: int = 100, search: str | None = None):
    # Cargamos la relación 'location' para saber el nombre de la sucursal
    query = db.query(models.Customer).options(joinedload(models.Customer.location))
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Customer.name).like(search_term),
                func.lower(models.Customer.id_card).like(search_term)
            )
        )
    return query.order_by(models.Customer.name).offset(skip).limit(limit).all()

def create_customer(db: Session, customer: schemas.CustomerCreate, location_id: int | None = None):
    # Añadimos el location_id al crear
    data = customer.model_dump()
    db_customer = models.Customer(**data, location_id=location_id)
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
        if user.role not in ["admin", "inventory_manager"]:
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
def get_company_settings(db: Session):
    """
    Obtiene la configuración de la empresa.
    Si NO existe (primera vez), crea una por defecto.
    """
    settings = db.query(models.CompanySettings).first()
    if not settings:
        # Creamos la identidad por defecto si está vacía
        settings = models.CompanySettings(
            name="Repara Xpress (Default)",
            ruc="9999999999001",
            address="Dirección Principal",
            phone="0999999999",
            email="info@miempresa.com"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def update_company_settings(db: Session, settings: schemas.CompanySettingsCreate):
    """
    Actualiza los datos de la empresa.
    """
    db_settings = get_company_settings(db) # Obtenemos la existente (o la default)
    
    # Actualizamos campos
    update_data = settings.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_settings, key, value)

    db.commit()
    db.refresh(db_settings)
    return db_settings

def update_company_logo(db: Session, logo_url: str):
    """
    Actualiza solo el logo.
    """
    db_settings = get_company_settings(db)
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