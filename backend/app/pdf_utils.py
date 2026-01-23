from io import BytesIO
from . import schemas
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
# --- LIBRERÍAS DE TIEMPO ---
import pytz
import os

# --- NOTA: Ahora las funciones reciben 'company_settings' ---

def generate_work_order_pdf(work_order: schemas.WorkOrder, company_settings: schemas.CompanySettings):
    buffer = BytesIO()
    width, height = 58 * mm, 297 * mm 
    c = canvas.Canvas(buffer, pagesize=(width, height))

    styles = getSampleStyleSheet()
    
    # --- ESTILOS ---
    style_title = ParagraphStyle(name='centered_bold', parent=styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=9, leading=11)
    style_centered = ParagraphStyle(name='centered', parent=styles['Normal'], alignment=TA_CENTER, fontSize=7, leading=9)
    style_normal = ParagraphStyle(name='normal', parent=styles['Normal'], fontSize=8, leading=10)
    style_bold = ParagraphStyle(name='bold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10)
    
    y = height - (5 * mm)

    def draw_paragraph(text, style, margin_left=4*mm):
        nonlocal y
        para = Paragraph(text, style)
        para.wrapOn(c, width - (margin_left * 2), height)
        p_height = para.height
        para.drawOn(c, margin_left, y - p_height)
        y -= p_height + (0.5 * mm)

    def draw_line(weight=0.5):
        nonlocal y
        y -= 2 * mm
        c.setLineWidth(weight)
        c.line(4 * mm, y, width - (4 * mm), y)
        y -= 2.5 * mm

    # --- CABECERA DINÁMICA INTELIGENTE (ORDEN DE TRABAJO) ---
    # Lógica de prioridad: Sucursal > Empresa
    
    # 1. Dirección
    display_address = company_settings.address
    if work_order.location and work_order.location.address:
        display_address = work_order.location.address # Gana la sucursal

    # 2. Teléfono
    display_phone = company_settings.phone
    if work_order.location and work_order.location.phone:
        display_phone = work_order.location.phone # Gana la sucursal

    # 3. Email
    display_email = company_settings.email
    if work_order.location and work_order.location.email:
        display_email = work_order.location.email # Gana la sucursal

    # --- DIBUJAR ---
    draw_paragraph(company_settings.name, style_title)
    
    if display_address:
        draw_paragraph(display_address, style_centered)
    
    draw_paragraph(f"RUC: {company_settings.ruc}", style_centered)
    
    if display_phone:
        draw_paragraph(f"Telf: {display_phone}", style_centered)
        
    if display_email:
        draw_paragraph(display_email, style_centered)

    y -= 3 * mm
    draw_line()
    # ---------------------------------------

    c.setFont("Helvetica-Bold", 8)
    c.drawString(5 * mm, y, f"Orden N°: {work_order.work_order_number}")
    c.setFont("Helvetica", 8)
    c.drawString(30 * mm, y, f"Fecha: {work_order.created_at.strftime('%d/%m/%Y')}")
    y -= 4 * mm
    
    # --- TÉCNICO RESPONSABLE ---
    if work_order.user:
        draw_paragraph(f"<b>Atendido por:</b> {work_order.user.email}", style_normal)
    
    draw_line()

    draw_paragraph("<b>CLIENTE:</b>", style_bold)
    draw_paragraph(f"{work_order.customer_name}", style_normal)
    draw_paragraph(f"<b>C.I:</b> {work_order.customer_id_card}", style_normal)
    draw_paragraph(f"<b>Telf:</b> {work_order.customer_phone}", style_normal)
    if work_order.customer_email:
        draw_paragraph(f"<b>Email:</b> {work_order.customer_email}", style_normal)
    if work_order.customer_address:
        draw_paragraph(f"<b>Dir:</b> {work_order.customer_address}", style_normal)
    y -= 2 * mm
    
    draw_paragraph("<b>EQUIPO:</b>", style_bold)
    draw_paragraph(f"{work_order.device_type} {work_order.device_brand} {work_order.device_model}", style_normal)
    if work_order.device_serial:
        draw_paragraph(f"S/N: {work_order.device_serial}", style_normal)
    y -= 2 * mm

    if work_order.physical_condition:
        draw_paragraph("<b>ESTADO DEL EQUIPO (Recepción):</b>", style_bold)
        draw_paragraph(work_order.physical_condition, style_normal)
        y -= 3 * mm
    
    draw_paragraph("<b>PROBLEMA REPORTADO:</b>", style_bold)
    draw_paragraph(work_order.reported_issue, style_normal)
    y -= 3 * mm

    draw_paragraph(f"<b>COSTO ESTIMADO:</b> ${work_order.estimated_cost:.2f}", style_normal)
    draw_paragraph(f"<b>ABONO:</b> ${work_order.deposit_amount:.2f}", style_normal)
    y -= 3 * mm
    draw_line()

    # Pie de página dinámico (mensaje configurado)
    if company_settings.footer_message:
        draw_paragraph(company_settings.footer_message, style_centered)

    y -= 5 * mm # Bajamos un poco antes de la firma

    # --- DIBUJAR FIRMA DIGITAL (SI EXISTE) ---
    if work_order.customer_signature:
        try:
            # 1. Construimos la ruta real del archivo en el servidor
            # La base de datos tiene: "/uploads/..." -> El disco tiene: "/code/uploads/..."
            image_path = f"/code{work_order.customer_signature}"
            
            if os.path.exists(image_path):
                # 2. Dibujamos la imagen centrada
                # Ajustamos coordenadas para que quede sobre la línea
                # x = centro (29mm) - mitad ancho firma (15mm) = 14mm
                c.drawImage(image_path, 14 * mm, y - 12 * mm, width=30 * mm, height=15 * mm, mask='auto')
        except Exception as e:
            print(f"Error dibujando firma en PDF: {e}")
    # -----------------------------------------

    y -= 10 * mm # Espacio que ocupa la firma visualmente

    c.line(8 * mm, y, width - (8 * mm), y)
    y -= 4 * mm
    draw_paragraph("Firma Cliente", style_centered)
    draw_paragraph(f"C.C: {work_order.customer_id_card}", style_centered)
    
    y -= 15 * mm
    c.line(8 * mm, y, width - (8 * mm), y)
    y -= 4 * mm
    draw_paragraph("Técnico Responsable", style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def generate_sale_receipt_pdf(sale: schemas.Sale, company_settings: schemas.CompanySettings):
    buffer = BytesIO()
    width, height = 58 * mm, 297 * mm
    c = canvas.Canvas(buffer, pagesize=(width, height))

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle(
        name="sale_centered_bold",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
    )
    style_centered = ParagraphStyle(
        name="sale_centered",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=7,
        leading=9,
    )
    style_normal = ParagraphStyle(
        name="sale_normal",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
    )

    y = height - (5 * mm)

    def draw_paragraph(text, style, margin_left=4 * mm):
        nonlocal y
        para = Paragraph(text, style)
        para.wrapOn(c, width - (margin_left * 2), height)
        p_height = para.height
        para.drawOn(c, margin_left, y - p_height)
        y -= p_height + (0.5 * mm)

    def draw_line(weight=0.5):
        nonlocal y
        y -= 2 * mm
        c.setLineWidth(weight)
        c.line(4 * mm, y, width - (4 * mm), y)
        y -= 2.5 * mm

    # --- CABECERA DINÁMICA INTELIGENTE (VENTA) ---
    
    # 1. Dirección
    display_address = company_settings.address
    if sale.location and sale.location.address:
        display_address = sale.location.address

    # 2. Teléfono
    display_phone = company_settings.phone
    if sale.location and sale.location.phone:
        display_phone = sale.location.phone

    # 3. Email
    display_email = company_settings.email
    if sale.location and sale.location.email:
        display_email = sale.location.email

    # --- DIBUJAR ---
    draw_paragraph(company_settings.name, style_title)
    
    if display_address:
        draw_paragraph(display_address, style_centered)
        
    draw_paragraph(f"RUC: {company_settings.ruc}", style_centered)
    
    if display_phone:
        draw_paragraph(f"Telf: {display_phone}", style_centered)
    
    if display_email:
        draw_paragraph(display_email, style_centered)

    y -= 3 * mm
    draw_line()
    # -----------------------------------------------

    c.setFont("Helvetica-Bold", 8)
    c.drawString(5 * mm, y, f"Venta N°: {sale.id}")
    
    y -= 4 * mm 

    c.setFont("Helvetica", 8)
    
    # 1. Obtenemos la zona horaria
    try:
        app_timezone_str = os.getenv("TZ", "America/Guayaquil")
        ecuador_tz = pytz.timezone(app_timezone_str)
    except pytz.UnknownTimeZoneError:
        ecuador_tz = pytz.timezone("America/Guayaquil")

    # 2. Convertimos la hora
    local_sale_time = sale.created_at.astimezone(ecuador_tz)
    
    # 3. Formateamos
    sale_date = local_sale_time.strftime("%d/%m/%Y %I:%M %p") 
    
    c.drawString(5 * mm, y, f"Fecha: {sale_date}")
    
    y -= 4 * mm

    if sale.location:
        draw_paragraph(f"<b>Sucursal:</b> {sale.location.name}", style_normal)
    if sale.user:
        draw_paragraph(f"<b>Atendido por:</b> {sale.user.email}", style_normal)
    draw_line()

    draw_paragraph("<b>CLIENTE:</b>", style_normal)
    draw_paragraph(f"{sale.customer_name}", style_normal)
    draw_paragraph(f"<b>C.I:</b> {sale.customer_ci}", style_normal)
    if sale.customer_phone:
        draw_paragraph(f"<b>Telf:</b> {sale.customer_phone}", style_normal)
    if sale.customer_email:
        draw_paragraph(f"<b>Email:</b> {sale.customer_email}", style_normal)
    if sale.customer_address:
        draw_paragraph(f"<b>Dir:</b> {sale.customer_address}", style_normal)
    y -= 2 * mm

    draw_paragraph("<b>DETALLE DE LA VENTA</b>", style_normal)
    draw_line()

    for item in sale.items:
        draw_paragraph(
            f"{item.quantity} x {item.description}",
            style_normal,
        )
        draw_paragraph(
            f"P.Unit: ${item.unit_price:.2f} | Subtotal: ${item.line_total:.2f}",
            style_normal,
            margin_left=6 * mm,
        )
        y -= 1 * mm

    draw_line()
    draw_paragraph(f"<b>Subtotal:</b> ${sale.subtotal_amount:.2f}", style_normal)
    draw_paragraph(
        f"<b>IVA ({sale.iva_percentage:.0f}%):</b> ${sale.tax_amount:.2f}",
        style_normal,
    )
    draw_paragraph(f"<b>Total:</b> ${sale.total_amount:.2f}", style_normal)

    formatted_payment_method = sale.payment_method.replace("_", " ").title()
    draw_paragraph(
        f"<b>Método de Pago:</b> {formatted_payment_method}",
        style_normal,
    )
    if sale.payment_method_details:
        if isinstance(sale.payment_method_details, list):
            for p in sale.payment_method_details:
                method = p.get("method", "PAGO")
                amount = p.get("amount", 0)
                ref = p.get("reference", "")
                
                text = f"- {method}: ${float(amount):.2f}"
                if ref:
                    text += f" (Ref: {ref})"
                
                draw_paragraph(text, style_normal, margin_left=6 * mm)
        
        elif isinstance(sale.payment_method_details, dict):
            details_str = ", ".join(
                f"{key}: {value}" for key, value in sale.payment_method_details.items()
            )
            draw_paragraph(details_str, style_normal, margin_left=6 * mm)

    if sale.work_order_id:
        draw_paragraph(
            f"Orden asociada: #{sale.work_order_id}",
            style_normal,
        )

    y -= 4 * mm

   # --- SECCIÓN GARANTÍA CORREGIDA ---
    if sale.warranty_terms:
        y -= 2 * mm # Un poco de aire antes
        draw_line(weight=0.25)
        
        # Título
        draw_paragraph("POLÍTICAS DE GARANTÍA", style_title) # Usamos style_title (centrado, negrita)
        y -= 1 * mm
        
        # Texto: Usamos un estilo normal pero centrado para que se vea ordenado
        # Importante: Paragraph se encarga de los saltos de línea automáticos
        p = Paragraph(sale.warranty_terms, style_centered) 
        w, h = p.wrap(width - 8*mm, height) # Le damos ancho para envolver
        p.drawOn(c, 4*mm, y - h)
        y -= h + (2 * mm) # Restamos la altura del párrafo + margen
        
        draw_line(weight=0.25)
    # -------------------------------------------------

    # Pie de página dinámico (mensaje configurado)
    # Pie de página dinámico (mensaje configurado)
    if company_settings.footer_message:
        draw_paragraph(company_settings.footer_message, style_centered)
    
    y -= 10 * mm 

    # Firma Cliente
    c.line(8 * mm, y, width - (8 * mm), y)
    y -= 4 * mm
    draw_paragraph("Firma Cliente", style_centered)
    draw_paragraph(f"C.C: {sale.customer_ci}", style_centered)

    y -= 10 * mm 

    # Firma Vendedor
    c.line(8 * mm, y, width - (8 * mm), y) 
    y -= 4 * mm
    draw_paragraph("Vendedor", style_centered)
    if sale.user:
        draw_paragraph(f"{sale.user.email}", style_centered)

    y -= 10 * mm 
    draw_paragraph("Notas:", style_normal, margin_left=5 * mm)
    y -= 15 * mm 
    c.rect(5 * mm, y, width - (10 * mm), 15 * mm)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

# --- INICIO: Generador de Nota de Crédito ---
def generate_credit_note_pdf(credit_note: schemas.CreditNote, company_settings: schemas.CompanySettings):
    buffer = BytesIO()
    width, height = 58 * mm, 297 * mm 
    c = canvas.Canvas(buffer, pagesize=(width, height))

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle(name='centered_bold', parent=styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=10, leading=12)
    style_centered = ParagraphStyle(name='centered', parent=styles['Normal'], alignment=TA_CENTER, fontSize=8, leading=10)
    style_normal = ParagraphStyle(name='normal', parent=styles['Normal'], fontSize=8, leading=10)
    style_code = ParagraphStyle(name='code', parent=styles['Normal'], alignment=TA_CENTER, fontName='Courier-Bold', fontSize=14, leading=16)

    y = height - (5 * mm)

    def draw_paragraph(text, style, margin_left=4*mm):
        nonlocal y
        para = Paragraph(text, style)
        para.wrapOn(c, width - (margin_left * 2), height)
        p_height = para.height
        para.drawOn(c, margin_left, y - p_height)
        y -= p_height + (0.5 * mm)

    def draw_line():
        nonlocal y
        y -= 2 * mm
        c.setLineWidth(0.5)
        c.line(4 * mm, y, width - (4 * mm), y)
        y -= 2.5 * mm

    # --- CABECERA EMPRESA ---
    draw_paragraph(company_settings.name, style_title)
    draw_paragraph(f"RUC: {company_settings.ruc}", style_centered)
    if company_settings.phone:
        draw_paragraph(f"Telf: {company_settings.phone}", style_centered)
    y -= 3 * mm
    draw_line()

    # --- TÍTULO ---
    draw_paragraph("NOTA DE CRÉDITO", style_title)
    draw_paragraph("(Saldo a Favor)", style_centered)
    y -= 3 * mm

    # --- CÓDIGO (EL DINERO) ---
    c.rect(4 * mm, y - 10*mm, width - 8*mm, 12*mm) # Caja alrededor del código
    y -= 2 * mm # Margen interno top
    draw_paragraph(credit_note.code, style_code)
    y -= 4 * mm # Margen interno bottom
    
    y -= 4 * mm

    # --- DETALLES ---
    fecha_str = credit_note.created_at.strftime('%d/%m/%Y %H:%M') if credit_note.created_at else "N/A"

    draw_paragraph(f"Fecha Emisión: {fecha_str}", style_normal)
    draw_paragraph(f"Valor: ${credit_note.amount:.2f}", style_title) # Valor en grande/negrita
    
    draw_line()
    
    draw_paragraph("<b>Motivo:</b>", style_normal)
    draw_paragraph(credit_note.reason, style_normal)
    
    y -= 5 * mm
    draw_paragraph("Este documento representa un saldo a favor. Preséntelo en caja para su próxima compra.", style_centered)
    draw_paragraph("Válido en todas nuestras sucursales.", style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
# --- FIN: Generador de Nota de Crédito ---


# --- INICIO: Generador de Acta de Entrega y Descargo (Profesional) ---
def generate_withdrawal_receipt_pdf(work_order: schemas.WorkOrder, company_settings: schemas.CompanySettings):
    """
    Genera un ACTA DE ENTREGA Y DESCARGO DE RESPONSABILIDAD.
    Detalla el estado de ingreso, el problema y la conformidad del retiro.
    """
    buffer = BytesIO()
    # Usamos un largo dinámico o fijo suficiente para el detalle. 
    # 200mm suele ser suficiente para recibos térmicos largos con detalles.
    width, height = 58 * mm, 220 * mm 
    c = canvas.Canvas(buffer, pagesize=(width, height))
    styles = getSampleStyleSheet()
    
    # --- Estilos Personalizados ---
    style_title = ParagraphStyle(
        name='title', 
        parent=styles['Normal'], 
        alignment=TA_CENTER, 
        fontName='Helvetica-Bold', 
        fontSize=10, 
        leading=12
    )
    style_subtitle = ParagraphStyle(
        name='subtitle', 
        parent=styles['Normal'], 
        alignment=TA_CENTER, 
        fontName='Helvetica-Bold', 
        fontSize=8, 
        leading=10
    )
    style_normal = ParagraphStyle(
        name='normal', 
        parent=styles['Normal'], 
        fontSize=8, 
        leading=10
    )
    style_small = ParagraphStyle(
        name='small', 
        parent=styles['Normal'], 
        fontSize=7, 
        leading=8
    )
    style_centered = ParagraphStyle(
        name='centered', 
        parent=styles['Normal'], 
        alignment=TA_CENTER, 
        fontSize=7, 
        leading=8
    )
    style_bold = ParagraphStyle(
        name='bold', 
        parent=styles['Normal'], 
        fontName='Helvetica-Bold', 
        fontSize=8, 
        leading=10
    )

    y = height - (5 * mm)

    # --- Funciones de Ayuda ---
    def draw_paragraph(text, style, margin_left=2*mm):
        nonlocal y
        # Envolver texto para que no se salga del ancho de 58mm
        p = Paragraph(text, style)
        avail_width = width - (margin_left * 2) - (2 * mm)
        w, h = p.wrap(avail_width, height)
        p.drawOn(c, margin_left, y - h)
        y -= h + (1 * mm) # Salto de línea

    def draw_separator():
        nonlocal y
        y -= 1.5 * mm
        c.setLineWidth(0.5)
        c.setDash(1, 2) # Línea punteada
        c.line(2 * mm, y, width - (2 * mm), y)
        c.setDash([]) # Resetear línea sólida
        y -= 2.5 * mm

    # ==========================================
    # 1. CABECERA (DATOS DE LA SUCURSAL)
    # ==========================================
    
    # Prioridad: Datos de la Sucursal > Datos de la Empresa
    branch_name = work_order.location.name if work_order.location else "Sucursal Principal"
    branch_address = work_order.location.address if (work_order.location and work_order.location.address) else company_settings.address
    branch_phone = work_order.location.phone if (work_order.location and work_order.location.phone) else company_settings.phone

    draw_paragraph(company_settings.name.upper(), style_title)
    draw_paragraph(f"RUC: {company_settings.ruc}", style_centered)
    
    # Datos específicos de la sucursal donde se emite
    if branch_name:
        draw_paragraph(branch_name, style_centered)
    if branch_address:
        draw_paragraph(branch_address, style_centered)
    if branch_phone:
        draw_paragraph(f"Telf: {branch_phone}", style_centered)
    
    draw_separator()

    # ==========================================
    # 2. TÍTULO DEL DOCUMENTO
    # ==========================================
    draw_paragraph("ACTA DE ENTREGA", style_title)
    draw_paragraph("(Retiro Sin Reparación)", style_subtitle)
    
    import datetime
    # Ajuste de hora (asumiendo servidor UTC, ajustamos visualmente si es necesario o usamos la del sistema)
    ahora = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    
    y -= 2 * mm
    draw_paragraph(f"<b>Fecha Emisión:</b> {ahora}", style_normal)
    draw_paragraph(f"<b>Orden N°:</b> {work_order.id}", style_bold)
    
    draw_separator()

    # ==========================================
    # 3. DATOS DEL CLIENTE Y EQUIPO
    # ==========================================
    draw_paragraph("<b>DATOS DEL CLIENTE:</b>", style_bold)
    draw_paragraph(f"{work_order.customer_name}", style_normal)
    draw_paragraph(f"CI/RUC: {work_order.customer_id_card}", style_normal)
    
    y -= 2 * mm
    draw_paragraph("<b>EQUIPO:</b>", style_bold)
    device_str = f"{work_order.device_type} {work_order.device_brand} {work_order.device_model}"
    draw_paragraph(device_str, style_normal)
    if work_order.device_serial:
        draw_paragraph(f"Serie/IMEI: {work_order.device_serial}", style_small)

    draw_separator()

    # ==========================================
    # 4. HISTORIAL DE INGRESO (LA DEFENSA)
    # ==========================================
    # Aquí mostramos cómo llegó el equipo para evitar reclamos de "me lo rayaron aquí"
    
    draw_paragraph("<b>CONDICIÓN DE INGRESO:</b>", style_bold)
    condition = work_order.physical_condition or "No registrada"
    draw_paragraph(condition, style_small)
    
    y -= 1.5 * mm
    draw_paragraph("<b>FALLA REPORTADA:</b>", style_bold)
    issue = work_order.reported_issue or "No registrada"
    draw_paragraph(issue, style_small)

    draw_separator()

    # ==========================================
    # 5. DETALLE DEL COBRO
    # ==========================================
    draw_paragraph(f"<b>COSTO REVISIÓN:</b> ${work_order.final_cost:.2f}", style_bold)
    # Si hubo abono, lo mostramos para claridad
    if work_order.deposit_amount > 0:
        draw_paragraph(f"(Abono Previo: ${work_order.deposit_amount:.2f})", style_small)
    
    draw_separator()

    # ==========================================
    # 6. DECLARACIÓN LEGAL (DESCARGO)
    # ==========================================
    disclaimer = (
        "El cliente declara recibir el equipo descrito anteriormente "
        "en las mismas condiciones físicas en las que ingresó, o según lo detallado "
        "en este documento. Se retira el equipo SIN REPARACIÓN por decisión del cliente "
        "o inviabilidad técnica, cancelando únicamente el valor del diagnóstico/revisión. "
        "La empresa queda liberada de cualquier responsabilidad posterior sobre el funcionamiento "
        "del equipo relacionado con la falla original no reparada."
    )
    draw_paragraph(disclaimer, style_small) # Texto legal en letra pequeña pero legible
    
    y -= 2 * mm
    draw_paragraph("Recibí Conforme:", style_centered)

    # ==========================================
    # 7. FIRMAS
    # ==========================================
    y -= 12 * mm # Espacio para firmar
    c.line(8 * mm, y, width - (8 * mm), y) # Línea de firma cliente
    y -= 3 * mm
    draw_paragraph("FIRMA CLIENTE", style_centered)
    draw_paragraph(f"CI: {work_order.customer_id_card}", style_centered)

    y -= 10 * mm # Espacio
    
    # Datos del Empleado (Usuario que atiende)
    employee_name = "Técnico Responsable"
    if work_order.user:
        # Intentamos usar nombre completo, sino email
        employee_name = getattr(work_order.user, 'full_name', None) or work_order.user.email
    
    c.line(8 * mm, y, width - (8 * mm), y) # Línea de firma empleado
    y -= 3 * mm
    draw_paragraph("ENTREGADO POR:", style_centered)
    draw_paragraph(str(employee_name), style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO: Generador de Reporte de Cierre DETALLADO ---
def generate_cash_closure_pdf(closure_data: dict, company_settings: schemas.CompanySettings, user_email: str, location_name: str):
    buffer = BytesIO()
    # Calculamos altura dinámica según la cantidad de items
    base_height = 200 * mm
    extra_height = (len(closure_data['sales_list']) + len(closure_data['expenses_list']) + len(closure_data['incomes_list'])) * 5 * mm
    width, height = 72 * mm, base_height + extra_height # Un poco más ancho (72mm) para que quepa el detalle
    
    c = canvas.Canvas(buffer, pagesize=(width, height))
    styles = getSampleStyleSheet()

    # Estilos
    style_title = ParagraphStyle(name='title', parent=styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=10, leading=12)
    style_centered = ParagraphStyle(name='centered', parent=styles['Normal'], alignment=TA_CENTER, fontSize=8, leading=10)
    style_normal = ParagraphStyle(name='normal', parent=styles['Normal'], fontSize=7, leading=9) # Letra más pequeña para detalle
    style_bold = ParagraphStyle(name='bold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10)

    y = height - (5 * mm)

    def draw_paragraph(text, style):
        nonlocal y
        p = Paragraph(text, style)
        w, h = p.wrap(width - 6*mm, height)
        p.drawOn(c, 3*mm, y - h)
        y -= h + (1.5 * mm)

    def draw_line():
        nonlocal y
        y -= 1 * mm
        c.setLineWidth(0.5)
        c.setDash(1, 2)
        c.line(2 * mm, y, width - (2 * mm), y)
        c.setDash([])
        y -= 2 * mm

    def draw_row(label, value, is_bold=False):
        nonlocal y
        font = "Helvetica-Bold" if is_bold else "Helvetica"
        c.setFont(font, 8)
        c.drawString(3 * mm, y, label)
        c.drawRightString(width - 3 * mm, y, f"${value:,.2f}")
        y -= 4 * mm

    def draw_detail_row(item):
        nonlocal y
        # Hora
        c.setFont("Helvetica", 6)
        time_str = item['time'].strftime("%H:%M")
        c.drawString(2 * mm, y, time_str)
        
        # Descripción Principal (Negrita si es Venta)
        desc = item['description'][:35] # Un poco más largo
        c.setFont("Helvetica-Bold", 7)
        c.drawString(10 * mm, y, desc)
        
        # Monto
        c.setFont("Helvetica-Bold", 7)
        c.drawRightString(width - 3 * mm, y, f"${item['amount']:.2f}")
        y -= 3 * mm

        # --- NUEVO: Línea de Detalle (Productos) ---
        if item.get('details'):
            c.setFont("Helvetica", 6)
            # Si es muy largo, lo cortamos para que no rompa el diseño
            det = item['details'][:60] + "..." if len(item['details']) > 60 else item['details']
            c.drawString(10 * mm, y, det)
            y -= 3 * mm
        # -------------------------------------------
        
        y -= 1 * mm # Separador extra entre items

    # --- CONTENIDO ---
    
    # Cabecera
    draw_paragraph(company_settings.name.upper(), style_title)
    draw_paragraph("REPORTE DE CIERRE DETALLADO", style_centered)
    
    y -= 2 * mm
    draw_paragraph(f"<b>Sucursal:</b> {location_name}", style_centered)
    draw_paragraph(f"<b>Cajero:</b> {user_email}", style_centered)
    
    from datetime import datetime
    start_val = closure_data.get('start_time')
    end_val = closure_data.get('end_time')

    start_str = start_val.strftime("%d/%m %H:%M") if isinstance(start_val, datetime) else "Inicio"
    end_str = end_val.strftime("%d/%m %H:%M") if isinstance(end_val, datetime) else "Actual"
    
    draw_paragraph(f"<b>Periodo:</b> {start_str} - {end_str}", style_centered)
    
    draw_line()

    # Resumen Financiero
    draw_paragraph("<b>RESUMEN GENERAL</b>", style_bold)
    y -= 2 * mm
    draw_row("Ventas Efectivo (+)", closure_data['total_cash_sales'])
    draw_row("Otros Ingresos (+)", closure_data['total_incomes'])
    draw_row("Gastos/Salidas (-)", closure_data['total_expenses'])
    
    y -= 2 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(3 * mm, y, "TOTAL EN CAJA:")
    c.drawRightString(width - 3 * mm, y, f"${closure_data['final_balance']:,.2f}")
    y -= 5 * mm

    draw_line()

    # --- DETALLES ---
    
    if closure_data['sales_list']:
        draw_paragraph("<b>DETALLE VENTAS EFECTIVO</b>", style_bold)
        y -= 2 * mm
        for item in closure_data['sales_list']:
            draw_detail_row(item)
        y -= 2 * mm

    if closure_data['expenses_list']:
        draw_paragraph("<b>DETALLE GASTOS / SALIDAS</b>", style_bold)
        y -= 2 * mm
        for item in closure_data['expenses_list']:
            draw_detail_row(item)
        y -= 2 * mm

    if closure_data['incomes_list']:
        draw_paragraph("<b>OTROS INGRESOS</b>", style_bold)
        y -= 2 * mm
        for item in closure_data['incomes_list']:
            draw_detail_row(item)
        y -= 2 * mm

    draw_line()
    
    # Firmas
    y -= 15 * mm
    c.line(10 * mm, y, width - 10 * mm, y)
    draw_paragraph("Firma Responsable", style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO: Generador de Reporte Histórico de Ventas ---
def generate_sales_history_pdf(sales_data: list, company_settings: schemas.CompanySettings, filters: dict):
    buffer = BytesIO()
    # Formato A4 Vertical
    c = canvas.Canvas(buffer, pagesize=(210 * mm, 297 * mm))
    width, height = 210 * mm, 297 * mm
    styles = getSampleStyleSheet()
    
    y = height - 20 * mm

    # Cabecera
    c.setFont("Helvetica-Bold", 14)
    c.drawString(15 * mm, y, company_settings.name.upper())
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawString(15 * mm, y, f"RUC: {company_settings.ruc}")
    y -= 10 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y, "REPORTE HISTÓRICO DE VENTAS")
    y -= 6 * mm
    
    # Filtros aplicados
    c.setFont("Helvetica", 9)
    
    # --- LÓGICA PARA MOSTRAR SUCURSAL ---
    loc_display = "TODAS LAS SUCURSALES" # Por defecto
    
    if filters.get('location_id'):
        # Si se filtró por ID, intentamos sacar el nombre real de los datos
        if sales_data and hasattr(sales_data[0], 'location') and sales_data[0].location:
            loc_display = f"SUCURSAL: {sales_data[0].location.name.upper()}"
        else:
            # Si no hay datos para sacar el nombre, ponemos un genérico claro
            loc_display = "SUCURSAL SELECCIONADA"

    filter_text = f"Desde: {filters.get('start_date', 'Inicio')}  |  Hasta: {filters.get('end_date', 'Hoy')}  |  {loc_display}"
    
    if filters.get('search'): filter_text += f"  |  Búsqueda: {filters['search']}"
    
    c.drawCentredString(width / 2, y, filter_text)
    y -= 10 * mm

    # Tabla Header
    c.setFont("Helvetica-Bold", 8)
    c.drawString(15 * mm, y, "ID")
    c.drawString(30 * mm, y, "FECHA")
    c.drawString(60 * mm, y, "CLIENTE")
    c.drawString(110 * mm, y, "VENDEDOR")
    c.drawString(150 * mm, y, "MÉTODO")
    c.drawRightString(195 * mm, y, "TOTAL")
    y -= 2 * mm
    c.line(15 * mm, y, 195 * mm, y)
    y -= 5 * mm

    total_sum = 0.0
    # --- ACUMULADORES PARA DESGLOSE ---
    total_cash = 0.0
    total_transfer = 0.0
    total_card = 0.0
    total_others = 0.0
    # ----------------------------------

    # Cuerpo
    c.setFont("Helvetica", 8)
    for sale in sales_data:
        # --- LÓGICA DE SUMA INTELIGENTE ---
        # 1. Si tiene detalles JSON (Venta Mixta o Nueva)
        if sale.payment_method_details:
            details_list = sale.payment_method_details if isinstance(sale.payment_method_details, list) else []
            # Si es dict, lo convertimos a lista ficticia
            if isinstance(sale.payment_method_details, dict):
                 # Soporte legacy simple
                 details_list = [{"method": sale.payment_method, "amount": sale.total_amount}]

            for p in details_list:
                m = p.get("method", "OTROS")
                amt = float(p.get("amount", 0))
                
                if m == "EFECTIVO": total_cash += amt
                elif m == "TRANSFERENCIA": total_transfer += amt
                elif m == "TARJETA": total_card += amt
                else: total_others += amt
        
        # 2. Si es venta antigua simple
        else:
            if sale.payment_method == "EFECTIVO": total_cash += sale.total_amount
            elif sale.payment_method == "TRANSFERENCIA": total_transfer += sale.total_amount
            elif sale.payment_method == "TARJETA": total_card += sale.total_amount
            else: total_others += sale.total_amount
        # ----------------------------------
        if y < 20 * mm: # Nueva página si se acaba el espacio
            c.showPage()
            y = height - 20 * mm
            c.setFont("Helvetica", 8)

        # Formato fecha
        date_str = sale.created_at.strftime("%d/%m/%Y %H:%M")
        
        # --- DIBUJAR FILA PRINCIPAL ---
        c.drawString(15 * mm, y, str(sale.id))
        c.drawString(30 * mm, y, date_str)
        c.drawString(60 * mm, y, sale.customer_name[:25])
        c.drawString(110 * mm, y, sale.user.email[:20])
        
        # Método de pago (Primera línea)
        method_str = sale.payment_method.replace("_", " ")
        c.drawString(150 * mm, y, method_str)
        
        c.drawRightString(195 * mm, y, f"${sale.total_amount:.2f}")
        
        total_sum += sale.total_amount
        y -= 4 * mm # Bajamos un poco para ver si hay detalles

        # --- DIBUJAR DETALLES DE PAGO (REFERENCIAS) ---
        # Si es MIXTO, TRANSFERENCIA o TARJETA y tiene detalles guardados
        if sale.payment_method_details:
            details = sale.payment_method_details
            
            # Caso 1: Es una lista de pagos (Estructura nueva del PaymentModal)
            if isinstance(details, list):
                c.setFont("Helvetica", 6) # Letra pequeña para el detalle
                for p in details:
                    # Solo mostramos si NO es efectivo o si tiene referencia explicita
                    if p.get("method") != "EFECTIVO" and p.get("reference"):
                        ref_text = f"• {p.get('method')[:4]}: {p.get('reference')}"
                        c.drawString(150 * mm, y, ref_text)
                        y -= 2.5 * mm # Espacio por cada línea de referencia
                c.setFont("Helvetica", 8) # Volvemos a letra normal

            # Caso 2: Es un diccionario simple (Estructura antigua o simple)
            elif isinstance(details, dict):
                ref = details.get("reference") or details.get("bank_reference")
                if ref:
                    c.setFont("Helvetica", 6)
                    c.drawString(150 * mm, y, f"Ref: {ref}")
                    y -= 2.5 * mm
                    c.setFont("Helvetica", 8)

        # Espacio final entre filas (si no hubo detalles, el 'y' bajó 4mm, si hubo, bajó más)
        # Ajustamos para asegurar separación uniforme
        y -= 2 * mm
    # --- CUADRO DE RESUMEN FINAL ---
    y -= 5 * mm
    c.line(15 * mm, y, 195 * mm, y)
    y -= 5 * mm

    # Dibujamos el resumen a la derecha, alineado con la columna de montos
    left_margin_summary = 130 * mm
    
    c.setFont("Helvetica", 9)
    
    # Efectivo
    c.drawString(left_margin_summary, y, "Total Efectivo:")
    c.drawRightString(195 * mm, y, f"${total_cash:.2f}")
    y -= 4 * mm
    
    # Transferencia
    c.drawString(left_margin_summary, y, "Total Transferencia:")
    c.drawRightString(195 * mm, y, f"${total_transfer:.2f}")
    y -= 4 * mm

    # Tarjeta (solo si hay)
    if total_card > 0:
        c.drawString(left_margin_summary, y, "Total Tarjeta:")
        c.drawRightString(195 * mm, y, f"${total_card:.2f}")
        y -= 4 * mm

    # Otros (solo si hay)
    if total_others > 0:
        c.drawString(left_margin_summary, y, "Otros / Notas Crédito:")
        c.drawRightString(195 * mm, y, f"${total_others:.2f}")
        y -= 4 * mm

    c.line(left_margin_summary, y, 195 * mm, y) # Línea pequeña de suma
    y -= 5 * mm
    
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left_margin_summary, y, "TOTAL GENERAL:")
    c.drawRightString(195 * mm, y, f"${total_sum:.2f}")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
# --- FIN DE NUESTRO CÓDIGO ---

# --- INICIO: Generador de Manifiesto de Envío (Formato Térmico) ---
def generate_transfer_manifest_pdf(transfer: schemas.TransferRead, company_settings: schemas.CompanySettings):
    """
    Genera un MANIFIESTO DE CARGA en formato térmico (58mm).
    """
    buffer = BytesIO()
    # Calculamos altura dinámica
    base_height = 180 * mm
    extra_height = len(transfer.items) * 10 * mm
    width, height = 58 * mm, base_height + extra_height 
    
    c = canvas.Canvas(buffer, pagesize=(width, height))
    styles = getSampleStyleSheet()

    # Estilos (reutilizamos la lógica visual de los otros recibos)
    style_title = ParagraphStyle(name='title', parent=styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=10, leading=12)
    style_centered = ParagraphStyle(name='centered', parent=styles['Normal'], alignment=TA_CENTER, fontSize=8, leading=10)
    style_normal = ParagraphStyle(name='normal', parent=styles['Normal'], fontSize=7, leading=9)
    style_bold = ParagraphStyle(name='bold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10)

    y = height - (5 * mm)

    def draw_paragraph(text, style):
        nonlocal y
        p = Paragraph(text, style)
        w, h = p.wrap(width - 6*mm, height)
        p.drawOn(c, 3*mm, y - h)
        y -= h + (1.5 * mm)

    def draw_line():
        nonlocal y
        y -= 1 * mm
        c.setLineWidth(0.5)
        c.setDash(1, 2)
        c.line(2 * mm, y, width - (2 * mm), y)
        c.setDash([])
        y -= 2 * mm

    # --- CONTENIDO ---

    # Cabecera Empresa
    draw_paragraph(company_settings.name.upper(), style_title)
    draw_paragraph(f"RUC: {company_settings.ruc}", style_centered)
    
    y -= 2 * mm
    draw_paragraph("MANIFIESTO DE CARGA", style_title)
    draw_paragraph("(Guía Interna)", style_centered)

    # Datos del Envío
    draw_paragraph(f"<b>N° Guía:</b> {transfer.id}", style_centered)
    
    # Formatear fecha
    if isinstance(transfer.created_at, str):
         # Si pydantic lo serializó a string, lo usamos directo o lo parseamos
         date_str = transfer.created_at.split('T')[0] 
    else:
         date_str = transfer.created_at.strftime("%d/%m/%Y %H:%M")

    draw_paragraph(f"<b>Fecha:</b> {date_str}", style_centered)
    
    draw_line()

    # Logística
    draw_paragraph("<b>ORIGEN (Remitente):</b>", style_bold)
    draw_paragraph(f"{transfer.source_location_name}", style_normal)
    draw_paragraph(f"Resp: {transfer.created_by_name}", style_normal)
    
    y -= 2 * mm
    
    draw_paragraph("<b>DESTINO (Receptor):</b>", style_bold)
    draw_paragraph(f"{transfer.destination_location_name}", style_normal)
    
    if transfer.note:
        draw_paragraph(f"Nota: {transfer.note}", style_normal)

    draw_line()

    # Detalle de Items
    draw_paragraph("<b>DETALLE DE LA CARGA</b>", style_bold)
    y -= 1 * mm
    
    # Encabezados tabla pequeña
    c.setFont("Helvetica-Bold", 7)
    c.drawString(3*mm, y, "CANT")
    c.drawString(15*mm, y, "DESCRIPCIÓN")
    y -= 3 * mm

    for item in transfer.items:
        # Cantidad
        c.setFont("Helvetica-Bold", 8)
        c.drawString(3*mm, y, str(item.quantity))
        
        # Descripción (con wrap manual simple)
        c.setFont("Helvetica", 7)
        desc = item.product_name[:25] # Cortamos si es muy largo para una línea
        c.drawString(15*mm, y, desc)
        
        # Casilla de verificación visual
        c.rect(width - 8*mm, y, 4*mm, 4*mm)
        
        y -= 5 * mm

    draw_line()
    
    # Firmas
    y -= 10 * mm
    c.line(10 * mm, y, width - 10 * mm, y)
    draw_paragraph("Firma Despacho", style_centered)

    y -= 10 * mm
    c.line(10 * mm, y, width - 10 * mm, y)
    draw_paragraph("Firma Recepción", style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
# --- FIN DE NUESTRO CÓDIGO ---