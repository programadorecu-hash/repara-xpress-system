
# backend/app/utils/money.py
from decimal import Decimal, ROUND_HALF_UP, getcontext

# 2 decimal places globally for money ops (can be increased for intermediate math if needed)
getcontext().prec = 28

CENT = Decimal("0.01")

def money(value) -> Decimal:
    """
    Convierte cualquier valor a Decimal con 2 decimales (ROUND_HALF_UP).
    Acepta str, int, float, Decimal.
    """
    if isinstance(value, Decimal):
        q = value
    else:
        q = Decimal(str(value))
    return q.quantize(CENT, rounding=ROUND_HALF_UP)

def calc_tax(subtotal: Decimal, iva_percentage: Decimal) -> Decimal:
    """
    IVA = subtotal * (iva_percentage / 100)
    """
    rate = money(iva_percentage) / Decimal("100")
    return money(subtotal * rate)

def calc_total(subtotal: Decimal, tax: Decimal) -> Decimal:
    return money(subtotal + tax)
