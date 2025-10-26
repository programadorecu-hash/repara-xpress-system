"""merge heads (1d64c9b6c9d0,92d2f21907fd)

Revision ID: b3c26339e2ec
Revises: 1d64c9b6c9d0, 92d2f21907fd
Create Date: 2025-10-26 18:19:41.158505

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c26339e2ec'
down_revision: Union[str, Sequence[str], None] = ('1d64c9b6c9d0', '92d2f21907fd')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
