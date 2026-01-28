import pandas as pd
import io
import random
import string
import unicodedata
from sqlalchemy.orm import Session
from . import models, crud

# --- DICCIONARIO DE COLUMNAS (TU NUEVA PLANTILLA OFICIAL) ---
EXPECTED_COLUMNS = {
    "TIPO": "product_type",         # Ej: PANTALLA
    "MARCA": "brand",               # Ej: SAMSUNG
    "MODELO": "model",              # Ej: A32
    "COLOR": "color",               # Ej: NEGRO
    "COMPATIBILIDAD": "compatibility", # Ej: A325M
    "CONDICION": "condition",       # Ej: NUEVO, USADO, GENERICO, ORIGINAL
    "PRECIO_PVP": "price_1",        # Tu Precio 1 (PVP)
    "PRECIO_DESCUENTO": "price_2",  # Tu Precio 2
    "PRECIO_WEB": "price_3",        # Tu Precio 3 (Distribuidor/Web)
    "COSTO_PROMEDIO": "average_cost",
    "CATEGORIA": "category_name",
    "STOCK_INICIAL": "quantity"
}

# --- INTELIGENCIA ARTIFICIAL (BÁSICA) PARA INTERPRETAR CONDICIONES ---
# Si el usuario escribe "AAA", el sistema entiende "GENERICO".
# Si escribe "100% Original", entiende "ORIGINAL".
CONDITION_MAP = {
    "NUEVO": "NUEVO", "NEW": "NUEVO", "NUEVA": "NUEVO",
    "USADO": "USADO", "USED": "USADO", "SEMI": "USADO", "SEMINUEVO": "USADO", "SEMI-NUEVO": "USADO",
    "GENERICO": "GENERICO", "GENÉRICO": "GENERICO", "AAA": "GENERICO", "COPY": "GENERICO", "COPIA": "GENERICO", "REEMPLAZO": "GENERICO",
    "ORIGINAL": "ORIGINAL", "ORG": "ORIGINAL", "100%": "ORIGINAL", "GENUINO": "ORIGINAL"
}

ALLOWED_CONDITIONS = ["NUEVO", "USADO", "GENERICO", "ORIGINAL"]

def normalize_text(text):
    """Limpia tildes y espacios extra para comparaciones robustas"""
    if not text: return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def interpret_condition(raw_condition):
    """
    Intenta adivinar qué quiso decir el usuario.
    Retorna la condición válida o None si no entiende.
    """
    clean = normalize_text(raw_condition)
    
    # 1. Búsqueda exacta en el mapa
    if clean in CONDITION_MAP:
        return CONDITION_MAP[clean]
    
    # 2. Búsqueda parcial (ej: "PANTALLA ORIGINAL")
    for key, val in CONDITION_MAP.items():
        if key in clean:
            return val
            
    return None # No entendimos

def generate_auto_sku(tipo, marca, modelo):
    """
    Genera un SKU automático: 3 letras Tipo + 3 letras Marca + 3 letras Modelo + 4 números azar
    Ej: PAN-SAM-A32-8492
    """
    t = normalize_text(tipo)
    b = normalize_text(marca)
    m = normalize_text(modelo)
    
    p1 = (t[:3] if t else "GEN")
    p2 = (b[:3] if b else "GEN")
    p3 = (m[:3] if m else "GEN")
    rand = ''.join(random.choices(string.digits, k=4))
    return f"{p1}-{p2}-{p3}-{rand}"

def generate_auto_name(tipo, marca, modelo, color, compatibilidad, condicion):
    """
    Construye el nombre automáticamente juntando las piezas.
    Ej: PANTALLA SAMSUNG A32 NEGRO (A325M) - ORIGINAL
    """
    parts = [tipo, marca, modelo, color]
    # Filtramos los que estén vacíos
    clean_parts = [str(p).strip().upper() for p in parts if p and str(p).lower() != "nan"]
    
    name = " ".join(clean_parts)
    
    if compatibilidad and str(compatibilidad).lower() != "nan":
        name += f" ({str(compatibilidad).upper()})"
    
    # Agregar condición al nombre si no es Nuevo (para diferenciar en el buscador)
    if condicion and condicion != "NUEVO":
        name += f" - {condicion}"
        
    return name

def process_excel_file(file_content: bytes, db: Session, company_id: int):
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        # Limpieza de encabezados
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        preview_data = []
        stats = {"nuevos": 0, "existentes": 0, "errores": 0}
        
        # Validación de columnas críticas
        missing_cols = [col for col in EXPECTED_COLUMNS.keys() if col not in df.columns]
        if missing_cols:
            return {
                "status": "error", 
                "message": f"Plantilla inválida. Faltan las columnas: {', '.join(missing_cols)}"
            }

        for index, row in df.iterrows():
            row_errors = [] # Lista para acumular quejas de esta fila

            # 1. Extraer y Limpiar Textos
            def clean_str(val):
                return str(val).strip().upper() if not pd.isna(val) else ""

            tipo = clean_str(row.get("TIPO", ""))
            marca = clean_str(row.get("MARCA", ""))
            modelo = clean_str(row.get("MODELO", ""))
            
            # --- VALIDACIÓN: DATOS OBLIGATORIOS ---
            if not tipo or not marca or not modelo or tipo == "NAN":
                if not tipo and not marca: continue # Fila vacía, ignorar
                row_errors.append("Falta TIPO, MARCA o MODELO.")

            # --- VALIDACIÓN: SÍMBOLOS RAROS ---
            forbidden_chars = ["@", "*", "#", "$", "%", "!", "?"]
            full_text = f"{tipo} {marca} {modelo}"
            for char in forbidden_chars:
                if char in full_text:
                    row_errors.append(f"No use el símbolo '{char}' en los nombres.")
                    break # Con uno basta para regañar

            # --- VALIDACIÓN: CONDICIÓN ---
            raw_cond = str(row.get("CONDICION", "NUEVO"))
            condicion = interpret_condition(raw_cond)
            if not condicion:
                row_errors.append(f"Condición '{raw_cond}' no válida. Use: NUEVO, USADO, GENERICO, ORIGINAL.")

            # --- VALIDACIÓN: PRECIOS Y NÚMEROS ---
            def validate_price(val, field_name):
                if pd.isna(val) or str(val).strip() == "":
                    return 0.0
                try:
                    # Quitamos $ y , por si acaso el usuario los puso
                    clean_val = str(val).replace("$", "").replace(",", "").strip()
                    return float(clean_val)
                except ValueError:
                    row_errors.append(f"Precio inválido en '{field_name}': '{val}'. Use punto decimal (ej: 10.50).")
                    return 0.0

            p_pvp = validate_price(row.get("PRECIO_PVP"), "PVP")
            p_desc = validate_price(row.get("PRECIO_DESCUENTO"), "DESCUENTO")
            p_web = validate_price(row.get("PRECIO_WEB"), "WEB")
            costo = validate_price(row.get("COSTO_PROMEDIO"), "COSTO")
            
            qty = 0
            try:
                raw_qty = row.get("STOCK_INICIAL")
                if not pd.isna(raw_qty):
                    qty = int(float(str(raw_qty).replace(",", "")))
            except:
                row_errors.append(f"Stock '{row.get('STOCK_INICIAL')}' no es un número entero.")

            # SI HUBO ERRORES, REPORTAMOS Y SALTAMOS LA FILA
            if row_errors:
                stats["errores"] += 1
                preview_data.append({
                    "row_index": index + 2,
                    "status": "ERROR",
                    "error_msg": " | ".join(row_errors),
                    "data": {"name": f"{tipo} {marca}..."}
                })
                continue

            # 2. Generación Automática (Si todo salió bien)
            color = clean_str(row.get("COLOR"))
            compat = clean_str(row.get("COMPATIBILIDAD"))
            categoria = clean_str(row.get("CATEGORIA")) or "GENERAL"

            auto_name = generate_auto_name(tipo, marca, modelo, color, compat, condicion)
            
            existing_product = db.query(models.Product).filter(
                models.Product.name == auto_name,
                models.Product.company_id == company_id
            ).first()

            row_status = "NUEVO"
            final_sku = ""
            conflict_details = None

            if existing_product:
                row_status = "EXISTE"
                final_sku = existing_product.sku
                stats["existentes"] += 1
                conflict_details = {
                    "db_name": existing_product.name,
                    "db_price": existing_product.price_1,
                    "excel_price": p_pvp
                }
            else:
                stats["nuevos"] += 1
                final_sku = generate_auto_sku(tipo, marca, modelo)

            clean_data = {
                "sku": final_sku,
                "name": auto_name,
                "description": f"{tipo} para {marca} {modelo}",
                "product_type": tipo,
                "brand": marca,
                "model": modelo,
                "color": color,
                "compatibility": compat,
                "condition": condicion,
                "category": categoria,
                "price_1": p_pvp,
                "price_2": p_desc,
                "price_3": p_web,
                "average_cost": costo,
                "quantity": qty
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
        return {"status": "error", "message": f"Error crítico procesando el archivo: {str(e)}"}