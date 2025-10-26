"""merge heads 52c5a276a25a + 0acfba2a2698

Revision ID: 69cbd33e5f55
Revises: 52c5a276a25a, 0acfba2a2698
Create Date: 2025-10-26 01:21:50.700726

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69cbd33e5f55'
down_revision: Union[str, Sequence[str], None] = ('52c5a276a25a', '0acfba2a2698')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
