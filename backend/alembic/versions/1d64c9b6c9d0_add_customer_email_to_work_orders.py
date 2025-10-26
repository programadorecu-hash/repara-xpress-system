"""Add customer_email to work orders"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1d64c9b6c9d0'
down_revision: Union[str, Sequence[str], None] = '0866cb4978c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add customer_email column to work_orders."""
    op.add_column('work_orders', sa.Column('customer_email', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove customer_email column from work_orders."""
    op.drop_column('work_orders', 'customer_email')
