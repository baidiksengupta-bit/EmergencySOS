import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class AlertStatus(str, enum.Enum):
    PENDING = "PENDING"
    TRIGGERED = "TRIGGERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class SOSAlert(Base, TimestampMixin):
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(AlertStatus),
        default=AlertStatus.TRIGGERED,
        nullable=False,
        index=True,
    )

    # Location data at moment of trigger
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)  # in meters
    address = Column(String(255), nullable=True)
    location_status = Column(String(50), nullable=False, default="ACCURATE")  # ACCURATE, DEGRADED, UNAVAILABLE
    google_maps_url = Column(String(500), nullable=True)

    # Operational Context
    message = Column(Text, nullable=True, default="Emergency SOS broadcast activated!")
    notification_status = Column(String(50), nullable=False, default="PENDING")  # ACCEPTED, FAILED, UNCONFIGURED, NO_RECIPIENTS
    contacts_alerted_count = Column(Integer, default=0, nullable=False)
    cancellation_reason = Column(String(255), nullable=True)
    triggered_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    resolved_at = Column(DateTime, nullable=True)

    # Database Relationships
    user = relationship("User", back_populates="alerts")
    breadcrumbs = relationship(
        "LocationBreadcrumb",
        back_populates="alert",
        cascade="all, delete-orphan",
        order_by="LocationBreadcrumb.recorded_at.asc()",
    )
