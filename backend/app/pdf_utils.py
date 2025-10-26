
from io import BytesIO
from . import schemas
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

def generate_work_order_pdf(work_order: schemas.WorkOrder):
    buffer = BytesIO()
    width, height = 58 * mm, 297 * mm 
    c = canvas.Canvas(buffer, pagesize=(width, height))

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle(name='centered_bold', parent=styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=9, leading=11)
    style_centered = ParagraphStyle(name='centered', parent=styles['Normal'], alignment=TA_CENTER, fontSize=7, leading=9)
    style_normal = ParagraphStyle(name='normal', parent=styles['Normal'], fontSize=8, leading=10)
    
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

    # --- INICIO DEL RECIBO ---
    draw_paragraph("Repara Xpress", style_title)
    draw_paragraph("Cocha Caguas Johanna Nathaly", style_centered)
    draw_paragraph("RUC: 1724293830001", style_centered)
    y -= 1 * mm
    draw_paragraph("Venta al por mayor de teléfonos y equipos de computación - partes y piezas", style_centered)
    y -= 3 * mm
    draw_line()

    c.setFont("Helvetica-Bold", 8)
    c.drawString(5 * mm, y, f"Orden N°: {work_order.work_order_number}")
    c.setFont("Helvetica", 8)
    c.drawString(30 * mm, y, f"Fecha: {work_order.created_at.strftime('%d/%m/%Y')}")
    y -= 4 * mm
    
    # --- NUEVO CAMPO: TÉCNICO RESPONSABLE ---
    draw_paragraph(f"<b>Atendido por:</b> {work_order.user.email}", style_normal)
    # --- CORRECCIÓN DE ESPACIO: Se eliminó un decremento innecesario de 'y' ---
    draw_line()

    draw_paragraph("<b>CLIENTE:</b>", style_normal)
    draw_paragraph(f"{work_order.customer_name}", style_normal)
    draw_paragraph(f"<b>C.I:</b> {work_order.customer_id_card}", style_normal)
    draw_paragraph(f"<b>Telf:</b> {work_order.customer_phone}", style_normal)
    if work_order.customer_email:
        draw_paragraph(f"<b>Email:</b> {work_order.customer_email}", style_normal)
    if work_order.customer_address:
        draw_paragraph(f"<b>Dir:</b> {work_order.customer_address}", style_normal)
    y -= 2 * mm
    
    draw_paragraph("<b>EQUIPO:</b>", style_normal)
    draw_paragraph(f"{work_order.device_type} {work_order.device_brand} {work_order.device_model}", style_normal)
    y -= 2 * mm

    draw_paragraph("<b>PROBLEMA REPORTADO:</b>", style_normal)
    draw_paragraph(work_order.reported_issue, style_normal)
    y -= 3 * mm

    draw_paragraph(f"<b>COSTO ESTIMADO:</b> ${work_order.estimated_cost:.2f}", style_normal)
    draw_paragraph(f"<b>ABONO:</b> ${work_order.deposit_amount:.2f}", style_normal)
    y -= 3 * mm
    draw_line()

    # (El resto del código es igual)
    draw_paragraph("<b>Matriz:</b> S49 Julio Andrade OE2-173", style_centered)
    draw_paragraph("Telf: 0969097844", style_centered)
    y -= 2 * mm
    draw_paragraph("<b>Sucursales:</b>", style_centered)
    draw_paragraph("Repara Conde: 0981497171", style_centered)
    draw_paragraph("Repara La Jota: 0981572019", style_centered)
    draw_paragraph("Repara Conocoto: 0999909128", style_centered)
    y -= 2 * mm
    draw_paragraph("Quito - Ecuador", style_centered)
    y -= 8 * mm

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


def generate_sale_receipt_pdf(sale: schemas.Sale):
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

    draw_paragraph("Repara Xpress", style_title)
    draw_paragraph("Cocha Caguas Johanna Nathaly", style_centered)
    draw_paragraph("RUC: 1724293830001", style_centered)
    y -= 1 * mm
    draw_paragraph(
        "Venta al por mayor de teléfonos y equipos de computación - partes y piezas",
        style_centered,
    )
    y -= 3 * mm
    draw_line()

    c.setFont("Helvetica-Bold", 8)
    c.drawString(5 * mm, y, f"Venta N°: {sale.id}")
    c.setFont("Helvetica", 8)
    sale_date = sale.created_at.strftime("%d/%m/%Y %H:%M")
    c.drawString(30 * mm, y, f"Fecha: {sale_date}")
    y -= 4 * mm

    draw_paragraph(f"<b>Sucursal:</b> {sale.location.name}", style_normal)
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
    draw_paragraph("Gracias por su compra", style_centered)
    draw_paragraph("Quito - Ecuador", style_centered)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer