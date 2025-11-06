
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.sql import func, and_, case, literal_column, or_
from sqlalchemy.orm import Session, joinedload, outerjoin, selectinload
from datetime import date
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
        full_file_path = f"/code{image_path_to_delete}"
        
        # Comprobamos si el archivo existe antes de intentar borrarlo para evitar errores.
        try:
            if os.path.exists(full_file_path):
                os.remove(full_file_path)
                print(f"Archivo eliminado: {full_file_path}") # Un log para nosotros
        except OSError as e:
            print(f"Error eliminando el archivo {full_file_path}: {e}")
            
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
    work_order_data = work_order.model_dump(exclude={"pin"})
    db_work_order = models.WorkOrder(**work_order_data, user_id=user_id, location_id=location_id)
    db.add(db_work_order)
    db.commit()
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
def create_sale(db: Session, sale: schemas.SaleCreate, user_id: int, location_id: int):
    try:
        bodega = get_primary_bodega_for_location(db, location_id=location_id)
        if not bodega:
            raise ValueError(f"La sucursal con ID {location_id} no tiene una bodega configurada.")

        if not sale.items:
            raise ValueError("La venta debe incluir al menos un ítem.")

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

        db_sale = models.Sale(
            subtotal_amount=subtotal_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            iva_percentage=sale.iva_percentage,
            payment_method=sale.payment_method,
            payment_method_details=sale.payment_method_details,

            # --- PASAR DATOS DEL CLIENTE ---
            customer_ci=sale.customer_ci,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            customer_address=sale.customer_address,
            customer_email=sale.customer_email,
            # --- FIN DATOS CLIENTE ---

            user_id=user_id,
            location_id=location_id,
            work_order_id=sale.work_order_id,
            items=sale_items_to_create
        )
        db.add(db_sale)
        db.flush()

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

        if sale.work_order_id:
            db_work_order = get_work_order(db, work_order_id=sale.work_order_id)
            if db_work_order:
                db_work_order.status = "ENTREGADO"
                # Guardamos el costo final de la orden como SUBTOTAL (¡sin IVA!)
                # Motivo: si más adelante se vuelve a “vender” esta misma orden, 
                # no se duplicará el impuesto ni se “inflará” el total.
                db_work_order.final_cost = subtotal_amount
                # --- INICIO DE NUESTRO CÓDIGO (Conectar Venta con Caja) ---
        
        # 1. Solo registramos el movimiento de dinero si la venta fue en EFECTIVO.
        #    (Si fue Transferencia o Tarjeta, el dinero no entra a la caja física)
        if sale.payment_method == "EFECTIVO":
            
            # 2. Buscamos la "Caja Fuerte de Ventas" de esta sucursal
            db_caja_ventas = db.query(models.CashAccount).filter(
                models.CashAccount.location_id == location_id,
                models.CashAccount.account_type == "CAJA_VENTAS"
            ).first()

            # 3. Si encontramos la caja...
            if db_caja_ventas:
                # 4. Creamos el "Recibo de Depósito" (la transacción)
                #    (Usamos la función que ya existía)
                db_transaction = models.CashTransaction(
                    amount=total_amount, # El monto total de la venta
                    description=f"Ingreso por Venta #{db_sale.id}",
                    user_id=user_id,
                    account_id=db_caja_ventas.id
                )
                db.add(db_transaction)
            else:
                # Si no hay caja (raro, pero puede pasar), lanzamos un error
                raise ValueError(f"No se encontró una 'Caja de Ventas' para la sucursal ID {location_id}.")
        
                # --- FIN DE NUESTRO CÓDIGO ---

        db.commit()
        db.refresh(db_sale)
        return db_sale
    except ValueError as e:
        db.rollback()
        # Re-raise as a generic exception so the endpoint can handle it
        raise Exception(str(e))
    except Exception as e:
        db.rollback()
        raise e


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
    db_account = models.CashAccount(**account.model_dump())
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
    total_sales = db.query(func.sum(models.Sale.total_amount)).filter(
        models.Sale.location_id == location_id,
        func.date(models.Sale.created_at) == target_date
    ).scalar() or 0.0

    # Calcula gastos totales del día en la ubicación
    cash_accounts = db.query(models.CashAccount).filter(
        models.CashAccount.location_id == location_id,
        models.CashAccount.account_type == 'CAJA_CHICA'
    ).all()
    account_ids = [acc.id for acc in cash_accounts]

    total_expenses = 0.0
    if account_ids:
        total_expenses = db.query(func.sum(models.CashTransaction.amount)).filter(
            models.CashTransaction.account_id.in_(account_ids),
            models.CashTransaction.amount < 0,
            func.date(models.CashTransaction.timestamp) == target_date
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