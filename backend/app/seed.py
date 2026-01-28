# backend/app/seed.py
import logging
from app.database import SessionLocal
from app.models import User, Location, Company, CompanySettings, CashAccount, ExpenseCategory
from app.security import get_password_hash

# Configuración de mensajes en consola
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DE TU PRIMER ACCESO ---
ADMIN_EMAIL = "programador.ecu@gmail.com" # <--- CAMBIA ESTO POR TU CORREO REAL
ADMIN_PASSWORD = "NoOlvido4734*.1"     # <--- CAMBIA ESTO POR UNA CLAVE REAL
ADMIN_PIN = "4734"                     # <--- TU PIN DE SEGURIDAD

def seed_data():
    db = SessionLocal()
    try:
        logger.info("🚀 Iniciando mudanza de datos para el lanzamiento...")

        # 1. CREAR LA EMPRESA (El Edificio)
        main_company = db.query(Company).filter_by(name="Repara Xpress").first()
        if not main_company:
            main_company = Company(
                name="Repara Xpress",
                plan_type="ANNUAL", # Plan Pro para el dueño
                is_active=True,
                modules={"pos": True, "inventory": True, "work_orders": True, "expenses": True} # Todos los poderes
            )
            db.add(main_company)
            db.flush() # Para obtener el ID de la empresa
            
            # Crear configuración visual de la empresa
            settings = CompanySettings(
                company_id=main_company.id,
                name="Repara Xpress Matriz",
                ruc="1799999999001",
                footer_message="¡Gracias por confiar en el mejor servicio técnico!"
            )
            db.add(settings)
            logger.info("✅ Empresa 'Repara Xpress' creada.")

        # 2. CREAR TU USUARIO SUPER ADMIN (El Dueño)
        admin_user = db.query(User).filter_by(email=ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                hashed_pin=get_password_hash(ADMIN_PIN),
                full_name="Erick Administrador",
                role="super_admin", # Rango máximo
                is_active=True,
                company_id=main_company.id # Vinculado a tu empresa
            )
            db.add(admin_user)
            logger.info(f"✅ Super Admin creado: {ADMIN_EMAIL}")

        # 3. CREAR SUCURSAL Y BODEGA DEMO
        demo_location = db.query(Location).filter_by(name="Sucursal Nueva Aurora", company_id=main_company.id).first()
        if not demo_location:
            # La Oficina
            new_aurora = Location(
                name="Sucursal Nueva Aurora",
                address="Quito, Sector Sur",
                company_id=main_company.id
            )
            db.add(new_aurora)
            db.flush()

            # La Bodega de esa oficina
            bodega_aurora = Location(
                name="Bodega Matriz",
                parent_id=new_aurora.id,
                company_id=main_company.id
            )
            db.add(bodega_aurora)
            
            # Crear una Caja de Efectivo para empezar a vender
            main_cash = CashAccount(
                name="Caja Principal Efectivo",
                account_type="EFECTIVO",
                location_id=new_aurora.id,
                company_id=main_company.id
            )
            db.add(main_cash)
            
            # Crear categorías de gastos básicas
            basic_expense = ExpenseCategory(
                name="Repuestos y Suministros",
                company_id=main_company.id
            )
            db.add(basic_expense)

            logger.info("✅ Sucursal, Bodega, Caja y Categorías iniciales creadas.")

        db.commit()
        logger.info("✨ ¡PROCESO COMPLETADO! Ya puedes borrar la base de datos con confianza.")

    except Exception as e:
        logger.error(f"❌ Error en la semilla: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()