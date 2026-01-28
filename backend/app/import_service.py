import pandas as pd
import io
import random
import string
from sqlalchemy.orm import Session
from . import models, crud

# --- DICCIONARIO DE COLUMNAS (TU NUEVA PLANTILLA OFICIAL) ---
# Quitamos SKU y NOMBRE. Añadimos los ingredientes para armarlos.
EXPECTED_COLUMNS = {
    "TIPO": "product_type",         # Ej: PANTALLA
    "MARCA": "brand",               # Ej: SAMSUNG
    "MODELO": "model",              # Ej: A32
    "COLOR": "color",               # Ej: NEGRO
    "COMPATIBILIDAD": "compatibility", # Ej: A325M
    "CONDICION": "condition",       # Ej: NUEVO, USADO/SEMI, GENERICO
    "PRECIO_PVP": "price_1",        # Tu Precio 1
    "PRECIO_DESCUENTO": "price_2",  # Tu Precio 2
    "PRECIO_WEB": "price_3",        # Tu Precio 3
    "COSTO_PROMEDIO": "average_cost",
    "CATEGORIA": "category_name",
    "STOCK_INICIAL": "quantity"
}

# Las condiciones permitidas (Regla de negocio)
ALLOWED_CONDITIONS = ["NUEVO", "USADO/SEMI", "GENERICO"]

def generate_auto_sku(tipo, marca, modelo):
    """
    Genera un SKU automático: 3 letras Tipo + 3 letras Marca + 3 letras Modelo + 4 números azar
    Ej: PAN-SAM-A32-8492
    """
    p1 = (tipo[:3] if tipo else "GEN").upper()
    p2 = (marca[:3] if marca else "GEN").upper()
    p3 = (modelo[:3] if modelo else "GEN").upper()
    rand = ''.join(random.choices(string.digits, k=4))
    return f"{p1}-{p2}-{p3}-{rand}"

def generate_auto_name(tipo, marca, modelo, color, compatibilidad, condicion):
    """
    Construye el nombre automáticamente juntando las piezas.
    Ej: PANTALLA SAMSUNG A32 NEGRO (A325M) - NUEVO
    """
    parts = [tipo, marca, modelo, color]
    # Filtramos los que estén vacíos (None o "")
    clean_parts = [str(p).strip().upper() for p in parts if p]
    
    name = " ".join(clean_parts)
    
    if compatibilidad:
        name += f" ({str(compatibilidad).upper()})"
    
    # Opcional: Agregar condición al nombre si no es Nuevo
    if condicion and condicion.upper() != "NUEVO":
        name += f" - {condicion.upper()}"
        
    return name

def process_excel_file(file_content: bytes, db: Session, company_id: int):
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        # Limpieza de encabezados (Mayúsculas y sin espacios extra)
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        preview_data = []
        stats = {"nuevos": 0, "existentes": 0, "errores": 0}
        
        # Validación de columnas críticas
        missing_cols = [col for col in EXPECTED_COLUMNS.keys() if col not in df.columns]
        if missing_cols:
            return {
                "status": "error", 
                "message": f"Faltan columnas obligatorias en el Excel: {', '.join(missing_cols)}"
            }

        for index, row in df.iterrows():
            # 1. Extraer datos crudos
            tipo = str(row.get("TIPO", "")).strip()
            marca = str(row.get("MARCA", "")).strip()
            modelo = str(row.get("MODELO", "")).strip()
            color = str(row.get("COLOR", "") if not pd.isna(row.get("COLOR")) else "")
            compat = str(row.get("COMPATIBILIDAD", "") if not pd.isna(row.get("COMPATIBILIDAD")) else "")
            condicion = str(row.get("CONDICION", "NUEVO")).strip().upper()
            
            # --- VALIDACIÓN 1: DATOS OBLIGATORIOS ---
            # Si no hay Tipo, Marca o Modelo, es basura.
            if not tipo or not marca or not modelo or tipo == "nan":
                stats["errores"] += 1
                preview_data.append({
                    "row_index": index + 2, # +2 porque Excel tiene header y empieza en 1
                    "status": "ERROR",
                    "error_msg": "Falta Tipo, Marca o Modelo",
                    "data": {"name": "Fila Incompleta"}
                })
                continue

            # --- VALIDACIÓN 2: CONDICIÓN VÁLIDA ---
            if condicion not in ALLOWED_CONDITIONS:
                stats["errores"] += 1
                preview_data.append({
                    "row_index": index + 2,
                    "status": "ERROR",
                    "error_msg": f"Condición '{condicion}' inválida. Use: {', '.join(ALLOWED_CONDITIONS)}",
                    "data": {"name": f"{tipo} {marca}..."}
                })
                continue

            # 2. Generación Automática (La Magia)
            auto_name = generate_auto_name(tipo, marca, modelo, color, compat, condicion)
            
            # Intentamos generar SKU, pero primero verificamos si ya existe ese producto
            # Buscamos por nombre generado para ver si ya existe algo idéntico
            existing_product = db.query(models.Product).filter(
                models.Product.name == auto_name,
                models.Product.company_id == company_id
            ).first()

            row_status = "NUEVO"
            final_sku = ""
            conflict_details = None

            if existing_product:
                row_status = "EXISTE"
                final_sku = existing_product.sku # Usamos el SKU que ya tiene
                stats["existentes"] += 1
                
                conflict_details = {
                    "db_name": existing_product.name,
                    "db_price": existing_product.price_1, # Comparamos precio PVP (P1)
                    "excel_price": float(row.get("PRECIO_PVP", 0) or 0)
                }
            else:
                stats["nuevos"] += 1
                final_sku = generate_auto_sku(tipo, marca, modelo) # Generamos uno nuevo

            # Datos limpios para el sistema
            clean_data = {
                "sku": final_sku, # Calculado
                "name": auto_name, # Calculado
                "description": f"{tipo} para {marca} {modelo}", # Autogenerado simple
                "product_type": tipo,
                "brand": marca,
                "model": modelo,
                "color": color,
                "compatibility": compat,
                "condition": condicion,
                "category": str(row.get("CATEGORIA", "General")),
                "price_1": float(row.get("PRECIO_PVP", 0) or 0),       # PVP
                "price_2": float(row.get("PRECIO_DESCUENTO", 0) or 0), # Descuento
                "price_3": float(row.get("PRECIO_WEB", 0) or 0),       # Web
                "average_cost": float(row.get("COSTO_PROMEDIO", 0) or 0),
                "quantity": int(row.get("STOCK_INICIAL", 0) or 0)
            }

            preview_data.append({
                "row_index": index,
                "data": clean_data,
                "status": row_status,
                "conflict": conflict_details
            })
            
        return {
            "status": "success", 
            "stats": stats,
            "preview": preview_data
        }

    except Exception as e:
        return {"status": "error", "message": f"Error crítico leyendo archivo: {str(e)}"}