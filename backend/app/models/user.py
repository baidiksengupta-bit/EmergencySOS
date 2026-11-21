from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    phone_number = Column(String(25), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Medical & Emergency Profile
    blood_group = Column(String(10), nullable=True, default="O+")
    allergies = Column(Text, nullable=True)
    medical_notes = Column(Text, nullable=True)
    emergency_pin = Column(String(10), nullable=True, default="1234")

    # Account Status & Push Notification
    is_active = Column(Boolean, default=True, nullable=False)
    fcm_token = Column(String(255), nullable=True)

    # Database Relationships
    contacts = relationship(
        "EmergencyContact",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="EmergencyContact.is_primary.desc()",
    )
    alerts = relationship(
        "SOSAlert",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="SOSAlert.triggered_at.desc()",
    )
