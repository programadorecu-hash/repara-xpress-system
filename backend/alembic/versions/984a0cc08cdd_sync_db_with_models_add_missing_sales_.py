"""sync db with models (add missing sales columns)

- Add subtotal_amount, tax_amount, iva_percentage with temporary server_default
- Optionally add payment_method_details (JSON) if not present
- Remove server_default after backfilling existing rows
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Alembic identifiers
revision = '984a0cc08cdd'
down_revision = '92d2f21907fd'
branch_labels = None
depends_on = None

def upgrade():
    # 1) Agregar con server_default temporal para no romper filas existentes
    op.add_column('sales', sa.Column('subtotal_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('sales', sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('sales', sa.Column('iva_percentage', sa.Float(), nullable=False, server_default='12'))

    # 2) (Opcional) Agregar payment_method_details si no existe aún
    #    Si ya existía, esta operación puede fallar; la protegemos con TRY en runtime usando SQL puro.
    conn = op.get_bind()
    has_col = conn.exec_driver_sql("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'payment_method_details'
        LIMIT 1
    """).fetchone()
    if not has_col:
        op.add_column('sales', sa.Column('payment_method_details', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # 3) Quitar los defaults para no dejarlos pegados
    op.alter_column('sales', 'subtotal_amount', server_default=None)
    op.alter_column('sales', 'tax_amount', server_default=None)
    op.alter_column('sales', 'iva_percentage', server_default=None)

def downgrade():
    # Revertir en orden inverso
    conn = op.get_bind()
    has_col = conn.exec_driver_sql("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'payment_method_details'
        LIMIT 1
    """).fetchone()
    if has_col:
        op.drop_column('sales', 'payment_method_details')

    op.drop_column('sales', 'iva_percentage')
    op.drop_column('sales', 'tax_amount')
    op.drop_column('sales', 'subtotal_amount')
