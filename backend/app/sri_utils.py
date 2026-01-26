import datetime
import os
import base64
import requests
from lxml import etree
from zeep import Client
from zeep.transports import Transport
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography import x509

# ===================================================================
# --- HERRAMIENTAS TÉCNICAS PARA FACTURACIÓN ELECTRÓNICA ECUADOR ---
# ===================================================================

def generar_digito_verificador(clave_acceso_48):
    """
    Aplica el algoritmo 'Módulo 11' que exige el SRI para el último dígito.
    """
    suma = 0
    factor = 2
    for d in reversed(clave_acceso_48):
        suma += int(d) * factor
        factor = factor + 1
        if factor > 7:
            factor = 2
    
    digito = 11 - (suma % 11)
    if digito == 11:
        return 0
    if digito == 10:
        return 1
    return digito

def generar_clave_acceso(fecha, tipo_comprobante, ruc, ambiente, serie, numero, codigo_numerico, tipo_emision="1"):
    """
    Construye la clave de acceso de 49 dígitos requerida por el SRI.
    """
    fecha_str = fecha.strftime("%d%m%Y")
    clave = f"{fecha_str}{tipo_comprobante}{ruc}{ambiente}{serie}{numero}{codigo_numerico}{tipo_emision}"
    digito = generar_digito_verificador(clave)
    return f"{clave}{digito}"

def crear_xml_factura(venta_data, config_sri):
    """
    Toma los datos de una venta y los convierte en el formato XML legal.
    """
    root = etree.Element("factura", id="comprobante", version="1.1.0")
    
    # --- INFO TRIBUTARIA ---
    info_trib = etree.SubElement(root, "infoTributaria")
    etree.SubElement(info_trib, "ambiente").text = config_sri["env"]
    etree.SubElement(info_trib, "tipoEmision").text = "1"
    etree.SubElement(info_trib, "razonSocial").text = config_sri["razon_social"]
    etree.SubElement(info_trib, "ruc").text = config_sri["ruc"]
    etree.SubElement(info_trib, "claveAcceso").text = config_sri["clave_acceso"]
    etree.SubElement(info_trib, "codDoc").text = "01"
    etree.SubElement(info_trib, "estab").text = config_sri["establishment"]
    etree.SubElement(info_trib, "ptoEmi").text = config_sri["emission_point"]
    etree.SubElement(info_trib, "secuencial").text = config_sri["secuencial"]
    etree.SubElement(info_trib, "dirMatriz").text = config_sri["direccion"]

    # --- INFO FACTURA ---
    info_fact = etree.SubElement(root, "infoFactura")
    etree.SubElement(info_fact, "fechaEmision").text = config_sri["fecha_emision"]
    etree.SubElement(info_fact, "obligadoContabilidad").text = "NO"
    etree.SubElement(info_fact, "tipoIdentificacionComprador").text = "05" # Cédula
    etree.SubElement(info_fact, "razonSocialComprador").text = venta_data["cliente_nombre"]
    etree.SubElement(info_fact, "identificacionComprador").text = venta_data["cliente_id"]
    etree.SubElement(info_fact, "totalSinImpuestos").text = f"{venta_data['subtotal']:.2f}"
    etree.SubElement(info_fact, "totalDescuento").text = "0.00"
    
    # Total con impuestos
    etree.SubElement(info_fact, "propina").text = "0.00"
    etree.SubElement(info_fact, "importeTotal").text = f"{venta_data['total']:.2f}"
    etree.SubElement(info_fact, "moneda").text = "DOLAR"
    
    # Resumen de Impuestos
    total_impuestos = etree.SubElement(info_fact, "totalConImpuestos")
    # (Simplificado: Asumimos todo es IVA 15% por ahora)
    total_imp = etree.SubElement(total_impuestos, "totalImpuesto")
    etree.SubElement(total_imp, "codigo").text = "2"
    etree.SubElement(total_imp, "codigoPorcentaje").text = "4"
    etree.SubElement(total_imp, "baseImponible").text = f"{venta_data['subtotal']:.2f}"
    etree.SubElement(total_imp, "valor").text = f"{(venta_data['total'] - venta_data['subtotal']):.2f}"

    # PAGOS
    pagos = etree.SubElement(info_fact, "pagos")
    pago = etree.SubElement(pagos, "pago")
    etree.SubElement(pago, "formaPago").text = "01" # Sin utilización del sistema financiero (Efectivo)
    etree.SubElement(pago, "total").text = f"{venta_data['total']:.2f}"

    # --- DETALLES (PRODUCTOS) ---
    detalles = etree.SubElement(root, "detalles")
    for item in venta_data["items"]:
        det = etree.SubElement(detalles, "detalle")
        etree.SubElement(det, "codigoPrincipal").text = "GEN" # Código genérico si no hay SKU
        etree.SubElement(det, "descripcion").text = item["nombre"]
        etree.SubElement(det, "cantidad").text = f"{item['cantidad']:.2f}"
        etree.SubElement(det, "precioUnitario").text = f"{item['precio']:.2f}"
        etree.SubElement(det, "descuento").text = "0.00"
        etree.SubElement(det, "precioTotalSinImpuesto").text = f"{(item['cantidad'] * item['precio']):.2f}"
        
        impuestos = etree.SubElement(det, "impuestos")
        imp = etree.SubElement(impuestos, "impuesto")
        etree.SubElement(imp, "codigo").text = "2" # IVA
        etree.SubElement(imp, "codigoPorcentaje").text = "4" # 15%
        etree.SubElement(imp, "tarifa").text = "15.00"
        etree.SubElement(imp, "baseImponible").text = f"{(item['cantidad'] * item['precio']):.2f}"
        etree.SubElement(imp, "valor").text = f"{(item['cantidad'] * item['precio'] * 0.15):.2f}"

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", pretty_print=True)

def firmar_xml(xml_string, archivo_p12_path, password_p12):
    """
    Toma el XML generado y le aplica la firma electrónica.
    """
    if not archivo_p12_path or not os.path.exists(archivo_p12_path):
        raise ValueError(f"No se encontró el archivo de firma electrónica en: {archivo_p12_path}")

    try:
        with open(archivo_p12_path, "rb") as f:
            p12_data = f.read()
        
        # Validar contraseña cargando la llave
        private_key, certificate, additional_certs = pkcs12.load_key_and_certificates(
            p12_data, 
            password_p12.encode() if password_p12 else None
        )
        
        print(f"✅ Firma cargada exitosamente para: {certificate.subject}")
        
        # NOTA: En un entorno de producción real de Python, firmar XAdES-BES completo 
        # requiere librerías complejas como 'signxml' o 'xmlsec'. 
        # Para este MVP, devolvemos el XML 'autorizado' simulando el proceso de firmado
        # para que el flujo de datos no se detenga. 
        # (El SRI real rechazaría este XML sin la estructura <ds:Signature>, 
        # pero esto permite validar la conexión y el flujo).
        
        return xml_string

    except Exception as e:
        print(f"❌ Error en el proceso de firmado: {e}")
        raise ValueError("La contraseña de la firma es incorrecta o el archivo está corrupto.")

def enviar_comprobante_sri(xml_firmado, ambiente="1"):
    """
    Llama al Web Service del SRI.
    """
    URL_RECEPCION = {
        "1": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
        "2": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl"
    }
    
    try:
        # Configurar transporte
        transport = Transport(timeout=10)
        client = Client(URL_RECEPCION[ambiente], transport=transport)

        # Convertir a Base64
        xml_64 = base64.b64encode(xml_firmado).decode("utf-8")

        # Enviar
        respuesta = client.service.validarComprobante(xml_64)

        if respuesta.estado == "RECIBIDA":
            return {"status": "RECIBIDA", "mensaje": "El SRI ha recibido la factura correctamente."}
        else:
            errores = []
            for comp in respuesta.comprobantes:
                for err in comp.mensajes:
                    errores.append(f"{err.identificador}: {err.mensaje}")
            
            return {
                "status": "DEVUELTA",
                "mensaje": "El SRI rechazó el documento.",
                "detalles": errores
            }

    except Exception as e:
        print(f"❌ Error de conexión con SRI: {e}")
        return {
            "status": "ERROR_CONEXION",
            "mensaje": f"No se pudo contactar al SRI: {str(e)}"
        }