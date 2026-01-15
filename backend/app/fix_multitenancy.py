# backend/app/fix_multitenancy.py
from sqlalchemy.orm import Session
from app import models, database

def migrate_data():
    db = database.SessionLocal()
    try:
        print("--- INICIANDO MUDANZA DE DATOS (MULTI-TENANCY) ---")

        # 1. Verificar si existe la Empresa #1
        company = db.query(models.Company).first()
        if not company:
            print("Creando la Empresa #1 (Default)...")
            company = models.Company(name="Empresa Principal", plan_type="PRO", is_active=True)
            db.add(company)
            db.commit()
            db.refresh(company)
        
        print(f"Usando Empresa ID: {company.id} - {company.name}")

        # 2. Lista de tablas que necesitan "dueño"
        # (Estas son las tablas a las que les agregamos company_id)
        tables_to_fix = [
            models.User,
            models.Location,
            models.Category,
            models.Product,
            models.Supplier,
            models.Customer,
            models.WorkOrder,
            models.Sale,
            models.CashAccount,
            models.ExpenseCategory,
            models.Expense,
            models.NotificationRule,
            models.CompanySettings
        ]

        # 3. Actualizar registros huérfanos
        for table_model in tables_to_fix:
            table_name = table_model.__tablename__
            
            # Contamos cuántos no tienen dueño
            count = db.query(table_model).filter(table_model.company_id == None).count()
            
            if count > 0:
                print(f"Mudando {count} registros de '{table_name}' a la Empresa #{company.id}...")
                # Actualización masiva
                db.query(table_model).filter(table_model.company_id == None).update(
                    {table_model.company_id: company.id}, 
                    synchronize_session=False
                )
            else:
                print(f"La tabla '{table_name}' ya está ordenada.")

        db.commit()
        print("--- ¡MUDANZA COMPLETADA CON ÉXITO! ---")
        print("Ahora todos tus datos pertenecen a la Empresa Principal.")

    except Exception as e:
        print(f"❌ Error durante la mudanza: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_data()