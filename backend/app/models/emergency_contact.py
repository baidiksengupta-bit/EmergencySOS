from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class EmergencyContact(Base, TimestampMixin):
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    phone_number = Column(String(25), nullable=False)
    relationship_label = Column(String(50), nullable=False, default="Family")
    email = Column(String(120), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="contacts")
