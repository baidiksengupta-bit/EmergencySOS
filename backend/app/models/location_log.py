from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class LocationBreadcrumb(Base):
    """
    GPS telemetry coordinates breadcrumb streamed while an SOS alert is actively triggered.
    """
    __tablename__ = "location_breadcrumbs"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(
        Integer,
        ForeignKey("sos_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    recorded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    alert = relationship("SOSAlert", back_populates="breadcrumbs")
