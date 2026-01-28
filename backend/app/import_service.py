import pandas as pd
import io
import random
import string
import unicodedata
from sqlalchemy.orm import Session, joinedload
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
CONDITION_MAP = {
    "NUEVO": "NUEVO", "NEW": "NUEVO", "NUEVA": "NUEVO",
    "USADO": "USADO", "USED": "USADO", "SEMI": "USADO", "SEMINUEVO": "USADO", "SEMI-NUEVO": "USADO",
    "GENERICO": "GENERICO", "GENÉRICO": "GENERICO", "AAA": "GENERICO", "COPY": "GENERICO", "COPIA": "GENERICO", "REEMPLAZO": "GENERICO",
    "ORIGINAL": "ORIGINAL", "ORG": "ORIGINAL", "100%": "ORIGINAL", "GENUINO": "ORIGINAL"
}

ALLOWED_CONDITIONS = ["NUEVO", "USADO", "GENERICO", "ORIGINAL"]

def normalize_text(text):
    if not text: return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def interpret_condition(raw_condition):
    clean = normalize_text(raw_condition)
    if clean in CONDITION_MAP:
        return CONDITION_MAP[clean]
    for key, val in CONDITION_MAP.items():
        if key in clean:
            return val
    return None

def generate_auto_sku(tipo, marca, modelo):
    t = normalize_text(tipo)
    b = normalize_text(marca)
    m = normalize_text(modelo)
    
    p1 = (t[:3] if t else "GEN")
    p2 = (b[:3] if b else "GEN")
    p3 = (m[:3] if m else "GEN")
    rand = ''.join(random.choices(string.digits, k=4))
    return f"{p1}-{p2}-{p3}-{rand}"

def generate_auto_name(tipo, marca, modelo, color, compatibilidad, condicion):
    parts = [tipo, marca, modelo, color]
    clean_parts = [str(p).strip().upper() for p in parts if p and str(p).lower() != "nan"]
    
    name = " ".join(clean_parts)
    
    if compatibilidad and str(compatibilidad).lower() != "nan":
        name += f" ({str(compatibilidad).upper()})"
    
    if condicion and condicion != "NUEVO":
        name += f" - {condicion}"
        
    return name

def process_excel_file(file_content: bytes, db: Session, company_id: int, target_location_id: int):
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        # Limpieza de encabezados
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        preview_data = []
        stats = {"nuevos": 0, "existentes": 0, "errores": 0}
        
        missing_cols = [col for col in EXPECTED_COLUMNS.keys() if col not in df.columns]
        if missing_cols:
            return {
                "status": "error", 
                "message": f"Plantilla inválida. Faltan las columnas: {', '.join(missing_cols)}"
            }

        # --- PRE-CARGAR PRODUCTOS EXISTENTES (Optimización) ---
        # Traemos productos y cargamos SUS STOCKS de una vez para no hacer 1000 consultas
        existing_products = db.query(models.Product).options(
            joinedload(models.Product.stock_entries)
        ).filter(models.Product.company_id == company_id).all()
        # Mapa por NOMBRE generado (para detectar duplicados exactos)
        product_map = {p.name: p for p in existing_products}

        for index, row in df.iterrows():
            row_errors = []

            def clean_str(val):
                return str(val).strip().upper() if not pd.isna(val) else ""

            tipo = clean_str(row.get("TIPO", ""))
            marca = clean_str(row.get("MARCA", ""))
            modelo = clean_str(row.get("MODELO", ""))
            
            if not tipo or not marca or not modelo or tipo == "NAN":
                if not tipo and not marca: continue
                row_errors.append("Falta TIPO, MARCA o MODELO.")

            forbidden_chars = ["@", "*", "#", "$", "%", "!", "?"]
            full_text = f"{tipo} {marca} {modelo}"
            for char in forbidden_chars:
                if char in full_text:
                    row_errors.append(f"No use el símbolo '{char}' en los nombres.")
                    break

            raw_cond = str(row.get("CONDICION", "NUEVO"))
            condicion = interpret_condition(raw_cond)
            if not condicion:
                row_errors.append(f"Condición '{raw_cond}' no válida.")

            def validate_price(val, field_name):
                if pd.isna(val) or str(val).strip() == "": return 0.0
                try:
                    clean_val = str(val).replace("$", "").replace(",", "").strip()
                    return float(clean_val)
                except ValueError:
                    row_errors.append(f"Precio inválido en '{field_name}': '{val}'. Use punto decimal.")
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

            if row_errors:
                stats["errores"] += 1
                preview_data.append({
                    "row_index": index + 2,
                    "status": "ERROR",
                    "error_msg": " | ".join(row_errors),
                    "data": {"name": f"{tipo} {marca}..."}
                })
                continue

            color = clean_str(row.get("COLOR"))
            compat = clean_str(row.get("COMPATIBILIDAD"))
            categoria = clean_str(row.get("CATEGORIA")) or "GENERAL"

            auto_name = generate_auto_name(tipo, marca, modelo, color, compat, condicion)
            
            # Buscamos en el mapa precargado
            existing_product = product_map.get(auto_name)

            row_status = "NUEVO"
            final_sku = ""
            conflict_details = None

            # --- NUEVO: Stock Actual del Sistema ---
            current_system_stock = 0

            if existing_product:
                row_status = "EXISTE"
                final_sku = existing_product.sku
                stats["existentes"] += 1
                
                # --- CORRECCIÓN DE STOCK ---
                # Buscamos el stock SOLO en la bodega destino seleccionada
                stock_entry = next((s for s in existing_product.stock_entries if s.location_id == target_location_id), None)
                current_system_stock = stock_entry.quantity if stock_entry else 0
                # ---------------------------

                conflict_details = {
                    "db_name": existing_product.name,
                    "db_price": existing_product.price_1, # P1 es PVP
                    "excel_price": p_pvp,
                    "db_stock": current_system_stock,     # <--- DATO CLAVE
                    "excel_stock": qty
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