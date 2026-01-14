"""hacer location_id opcional en cash_accounts

Revision ID: hacer_location_id_opcional
Revises: 9cca612fe4a4
Create Date: 2026-01-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'hacer_location_id_opcional' # Este ID debe ser único, si te da error, deja el que generó alembic
down_revision = '9cca612fe4a4' # <--- OJO: Asegúrate de que este coincida con tu última migración (la de notificaciones)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Permitimos que location_id sea NULL
    op.alter_column('cash_accounts', 'location_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    
    # Eliminamos la restricción única anterior (nombre + location) porque daba problemas con globales
    # Primero intentamos borrarla por nombre (el nombre puede variar según tu DB, pero intentamos el estándar)
    try:
        op.drop_constraint('_cash_account_name_location_uc', 'cash_accounts', type_='unique')
    except:
        pass # Si no existe, no pasa nada

    # Creamos una nueva restricción única parcial:
    # 1. Nombre único por sucursal (para cuentas locales)
    op.create_index('ix_cash_accounts_name_location', 'cash_accounts', ['name', 'location_id'], unique=True, postgresql_where=sa.text("location_id IS NOT NULL"))
    
    # 2. Nombre único para cuentas globales (location_id IS NULL)
    op.create_index('ix_cash_accounts_name_global', 'cash_accounts', ['name'], unique=True, postgresql_where=sa.text("location_id IS NULL"))


def downgrade() -> None:
    # Revertir cambios (volver a NOT NULL)
    # Nota: Esto fallará si hay cuentas globales creadas
    op.drop_index('ix_cash_accounts_name_global', table_name='cash_accounts')
    op.drop_index('ix_cash_accounts_name_location', table_name='cash_accounts')
    
    op.alter_column('cash_accounts', 'location_id',
               existing_type=sa.INTEGER(),
               nullable=False)