"""create journal tables

Revision ID: 19ae0305bad1
Revises:
Create Date: 2026-10-10 22:00:04.662886
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "19ae0305bad1"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "language IN ('es', 'fr', 'de', 'it', 'pt')", name=op.f("ck_entries_language_supported")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_entries")),
    )
    op.create_index("ix_entries_language_created_at", "entries", ["language", "created_at"], unique=False)
    op.create_table(
        "analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("entry_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "succeeded",
                "failed",
                name="analysis_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("corrected_text", sa.Text(), nullable=True),
        sa.Column("feedback_summary", sa.Text(), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("prompt_version", sa.String(length=20), nullable=False),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column(
            "error_code",
            sa.Enum(
                "provider_timeout",
                "invalid_output",
                "provider_error",
                name="analysis_error_code",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=True,
        ),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("retried", sa.Boolean(), nullable=False),
        sa.Column("dropped_mistakes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["entry_id"], ["entries.id"], name=op.f("fk_analyses_entry_id_entries"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analyses")),
    )
    op.create_index("ix_analyses_entry_id_created_at", "analyses", ["entry_id", "created_at"], unique=False)
    op.create_table(
        "mistakes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("analysis_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "error",
                "suggestion",
                "vocab_help",
                name="mistake_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.Enum(
                "verb_conjugation",
                "verb_tense",
                "gender_agreement",
                "number_agreement",
                "article",
                "preposition",
                "word_order",
                "spelling",
                "vocabulary",
                "punctuation",
                "other",
                name="mistake_category",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("original", sa.Text(), nullable=False),
        sa.Column("correction", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=True),
        sa.Column("end_offset", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["analysis_id"],
            ["analyses.id"],
            name=op.f("fk_mistakes_analysis_id_analyses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mistakes")),
    )
    op.create_index("ix_mistakes_analysis_id", "mistakes", ["analysis_id"], unique=False)
    op.create_index("ix_mistakes_category", "mistakes", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_mistakes_category", table_name="mistakes")
    op.drop_index("ix_mistakes_analysis_id", table_name="mistakes")
    op.drop_table("mistakes")
    op.drop_index("ix_analyses_entry_id_created_at", table_name="analyses")
    op.drop_table("analyses")
    op.drop_index("ix_entries_language_created_at", table_name="entries")
    op.drop_table("entries")
