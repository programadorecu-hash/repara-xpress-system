# backend/app/seed.py
# Esta es nuestra "lista de tareas" para crear los datos iniciales.

import logging
from app.database import SessionLocal, engine
from app.models import Base, User, Location
from app.security import get_password_hash

# Configuración básica para ver mensajes en la terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONTRASEÑA TEMPORAL ---
# Todos usarán esta contraseña para empezar. ¡Deben cambiarla después!
TEMPORAL_PASSWORD = "repara123"

# --- 1. Definir Sucursales (Oficinas Principales) ---
# Aquí listamos las 4 sucursales que mencionaste.
sucursales_data = [
    {"name": "Sucursal Matriz Nueva Aurora", "description": "Sucursal principal"},
    {"name": "Sucursal 1 El Conde", "description": "Sucursal en el sector de El Conde"},
    {"name": "Sucursal 2 La Jota", "description": "Sucursal en el sector de La Jota"},
    {"name": "Sucursal 3 Conocoto", "description": "Sucursal en el Valle de los Chillos"},
]

# --- 2. Definir Usuarios (Equipo) ---
# Aquí creamos los 3 pases de identidad.
users_data = [
    {
        "email": "erick@reparaxpress.com",
        "role": "admin", # El "dueño"
        "password": TEMPORAL_PASSWORD
    },
    {
        "email": "nathaly@reparaxpress.com",
        "role": "inventory_manager", # "administradora de bodega"
        "password": TEMPORAL_PASSWORD
    },
    {
        "email": "estefano@reparaxpress.com",
        "role": "warehouse_operator", # "empleado"
        "password": TEMPORAL_PASSWORD
    },
]

def seed_data():
    # Abrimos una "conversación" con la base de datos
    db = SessionLocal()
    try:
        # --- PASO A: CREAR SUCURSALES Y BODEGAS ---
        logger.info("Creando sucursales y bodegas...")

        for data in sucursales_data:
            # Revisar si ya existe la sucursal
            exists = db.query(Location).filter_by(name=data["name"]).first()
            
            if not exists:
                # 1. Crear la sucursal (la "oficina")
                db_sucursal = Location(
                    name=data["name"],
                    description=data["description"],
                    parent_id=None # Es una oficina principal, no tiene "jefe"
                )
                db.add(db_sucursal)
                
                # Hacemos un "pre-guardado" para que la base de datos nos dé el ID
                db.flush() 
                
                # 2. Crear su bodega (el "cuarto de almacenamiento")
                db_bodega = Location(
                    name=f"Bodega - {data['name']}",
                    description=f"Almacén en {data['name']}",
                    parent_id=db_sucursal.id # La "conectamos" a la oficina
                )
                db.add(db_bodega)
                logger.info(f"Creada: {db_sucursal.name} y su bodega.")
            else:
                 logger.warning(f"Ya existe: {data['name']}. Saltando.")

        # Guardamos todos los cambios de este paso
        db.commit()

        # --- PASO B: CREAR USUARIOS ---
        logger.info("Creando usuarios...")
        
        for data in users_data:
            # Revisar si ya existe el email
            exists = db.query(User).filter_by(email=data["email"]).first()
            if not exists:
                # Obtenemos la contraseña "encriptada"
                hashed_password = get_password_hash(data["password"])
                db_user = User(
                    email=data["email"],
                    hashed_password=hashed_password,
                    role=data["role"],
                    is_active=True
                )
                db.add(db_user)
                logger.info(f"Creado usuario: {db_user.email} (Rol: {db_user.role})")
            else:
                logger.warning(f"Ya existe: {data['email']}. Saltando.")
        
        # Guardamos los usuarios
        db.commit()

        logger.info("¡Datos iniciales creados con éxito!")

    except Exception as e:
        logger.error(f"Error al crear datos: {e}")
        db.rollback() # Si algo falla, deshacemos todo
    finally:
        db.close() # Cerramos la "conversación"

# Esto hace que el script se pueda ejecutar
if __name__ == "__main__":
    logger.info("Iniciando el proceso de 'sembrado' de datos...")
    seed_data()