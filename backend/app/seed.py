# backend/app/seed.py
import logging
from app.database import SessionLocal
from app.models import User, Location, Company, CompanySettings, CashAccount, ExpenseCategory
from app.security import get_password_hash

# Configuración de mensajes en consola
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 1. CONFIGURACIÓN DE TU ACCESO REAL (DUEÑO) ---
ADMIN_EMAIL = "programador.ecu@gmail.com" 
ADMIN_PASSWORD = "NoOlvido4734*.1"     # <--- PON TU CLAVE REAL AQUÍ
ADMIN_PIN = "4734"                     # <--- PON TU PIN REAL AQUÍ

# --- 2. CONFIGURACIÓN DE LA EMPRESA DEMO ---
DEMO_NAME = "DEMOSTRACIÓN"
DEMO_EMAIL = "demo"           # <--- USA ESTE CORREO PARA ENTRAR A LA DEMO
DEMO_PASS = "demo"
DEMO_PIN = "1234"

def seed_data():
    db = SessionLocal()
    try:
        logger.info("🚀 Preparando el sistema para el gran lanzamiento...")

        # ========== SECCIÓN: TU EMPRESA REAL ==========
        main_company = db.query(Company).filter_by(name="ReparaSoft®").first()
        if not main_company:
            main_company = Company(
                name="Repara Xpress",
                plan_type="ANNUAL",
                is_active=True,
                modules={"pos": True, "inventory": True, "work_orders": True, "expenses": True}
            )
            db.add(main_company)
            db.flush()
            
            db.add(CompanySettings(company_id=main_company.id, name="Repara Xpress Matriz"))
            
            # Aquí te creamos directamente como SUPER ADMIN
            db.add(User(
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                hashed_pin=get_password_hash(ADMIN_PIN),
                full_name="Erick Administrador",
                role="super_admin", # 👑 Rol máximo otorgado
                is_active=True,
                company_id=main_company.id
            ))
            logger.info(f"✅ Empresa Real y Super Admin ({ADMIN_EMAIL}) listos.")

        # ========== SECCIÓN: EMPRESA DEMO ==========
        demo_company = db.query(Company).filter_by(name=DEMO_NAME).first()
        if not demo_company:
            demo_company = Company(
                name=DEMO_NAME,
                plan_type="FREE",
                is_active=True,
                modules={"pos": True, "inventory": True, "work_orders": True, "expenses": True}
            )
            db.add(demo_company)
            db.flush()

            db.add(CompanySettings(company_id=demo_company.id, name=DEMO_NAME))

            # Usuario demo/demo
            db.add(User(
                email=DEMO_EMAIL,
                hashed_password=get_password_hash(DEMO_PASS),
                hashed_pin=get_password_hash(DEMO_PIN),
                full_name="Usuario de Demostración",
                role="admin", # Admin de su propia parcela
                is_active=True,
                company_id=demo_company.id
            ))

            # Crear un local básico para que la demo funcione
            loc_demo = Location(name="Sucursal de Pruebas", company_id=demo_company.id)
            db.add(loc_demo)
            logger.info(f"✅ Empresa DEMO y usuario '{DEMO_EMAIL}' listos.")

        db.commit()
        logger.info("✨ ¡PROCESO EXITOSO! El sistema está configurado y listo para despegar.")

    except Exception as e:
        logger.error(f"❌ Error al sembrar datos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()