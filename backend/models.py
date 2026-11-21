"""
EmergencySOS - Database Models
==============================
SQLAlchemy ORM models defining the database schema:
1. User - Registered application users
2. EmergencyContact - Trusted contacts designated for emergency alerts
3. SOSAlert - Recorded emergency panic events and location coordinates
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    """
    User Model
    ----------
    Represents an EmergencySOS user account.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    # One User can have multiple emergency contacts and SOS alerts.
    # cascade="all, delete-orphan" ensures child records are removed if the user is deleted.
    contacts = relationship(
        "EmergencyContact",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    alerts = relationship(
        "SOSAlert",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', email='{self.email}')>"


class EmergencyContact(Base):
    """
    EmergencyContact Model
    ----------------------
    Represents a trusted contact saved by a user to be notified during an SOS alert.
    """
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship back to User
    user = relationship("User", back_populates="contacts")

    def __repr__(self):
        return f"<EmergencyContact(id={self.id}, name='{self.name}', phone='{self.phone_number}')>"


class SOSAlert(Base):
    """
    SOSAlert Model
    --------------
    Represents an emergency panic alert triggered by a user, including coordinates and status.
    """
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, default="active", nullable=False)  # e.g., 'active', 'resolved', 'cancelled'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship back to User
    user = relationship("User", back_populates="alerts")

    def __repr__(self):
        return f"<SOSAlert(id={self.id}, user_id={self.user_id}, status='{self.status}')>"
