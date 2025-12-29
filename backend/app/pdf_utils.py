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

    y -= 15 * mm # Espacio para firma

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