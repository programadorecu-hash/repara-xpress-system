"""merge multiple heads

Revision ID: 83a803de2219
Revises: hacer_location_id_opcional, ec06aaf2b045
Create Date: 2026-01-14 18:33:18.328591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83a803de2219'
down_revision: Union[str, Sequence[str], None] = ('hacer_location_id_opcional', 'ec06aaf2b045')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
