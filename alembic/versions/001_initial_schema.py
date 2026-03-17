"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # contacts
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("last_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("company", sa.Text(), server_default=""),
        sa.Column("title", sa.Text(), server_default=""),
        sa.Column("industry", sa.Text(), server_default=""),
        sa.Column("linkedin_url", sa.Text(), server_default=""),
        sa.Column("city", sa.Text(), server_default=""),
        sa.Column("country", sa.Text(), server_default=""),
        sa.Column("apollo_id", sa.String(100), unique=True, nullable=True),
        sa.Column("status", sa.Enum("new", "in_campaign", "replied", "unsubscribed", "bounced", name="contactstatus"), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_contacts_email", "contacts", ["email"])
    op.create_index("ix_contacts_apollo_id", "contacts", ["apollo_id"])

    # campaigns
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("persona_filters", postgresql.JSONB(), server_default="{}"),
        sa.Column("status", sa.Enum("draft", "active", "paused", "completed", name="campaignstatus"), nullable=False, server_default="draft"),
        sa.Column("email_channel", sa.Boolean(), server_default="true"),
        sa.Column("linkedin_channel", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # sequence_steps
    op.create_table(
        "sequence_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("channel", sa.Enum("email", "linkedin", name="stepchannel"), nullable=False, server_default="email"),
        sa.Column("delay_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("subject_template", sa.Text(), server_default=""),
        sa.Column("body_template", sa.Text(), server_default=""),
        sa.Column("linkedin_message_template", sa.Text(), server_default=""),
    )

    # campaign_leads
    op.create_table(
        "campaign_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.Enum("active", "replied", "opted_out", "completed", "paused", name="campaignleadstatus"), nullable=False, server_default="active"),
        sa.Column("next_send_at", sa.DateTime(), nullable=True),
        sa.Column("enrolled_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # email_events
    op.create_table(
        "email_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaign_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.Enum("sent", "delivered", "opened", "clicked", "bounced", "replied", name="emaileventtype"), nullable=False),
        sa.Column("mailgun_message_id", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # linkedin_events
    op.create_table(
        "linkedin_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaign_leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.Enum("connection_sent", "connection_accepted", "message_sent", "replied", name="linkedineventtype"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # unsubscribes
    op.create_table(
        "unsubscribes",
        sa.Column("email", sa.String(320), primary_key=True),
        sa.Column("unsubscribed_at", sa.DateTime(), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("unsubscribes")
    op.drop_table("linkedin_events")
    op.drop_table("email_events")
    op.drop_table("campaign_leads")
    op.drop_table("sequence_steps")
    op.drop_table("campaigns")
    op.drop_table("contacts")
    op.execute("DROP TYPE IF EXISTS contactstatus")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
    op.execute("DROP TYPE IF EXISTS stepchannel")
    op.execute("DROP TYPE IF EXISTS campaignleadstatus")
    op.execute("DROP TYPE IF EXISTS emaileventtype")
    op.execute("DROP TYPE IF EXISTS linkedineventtype")
