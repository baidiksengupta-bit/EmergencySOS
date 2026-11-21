from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ContactBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Contact full name")
    phone_number: str = Field(..., min_length=5, max_length=25, description="Contact phone number")
    relationship_label: str = Field("Family", max_length=50, description="e.g. Spouse, Parent, Doctor")
    email: Optional[EmailStr] = Field(None, description="Optional email for notification relay")
    is_primary: bool = Field(False, description="Set as primary first-responder contact")


class ContactCreate(ContactBase):
    user_id: Optional[int] = Field(None, description="Optional explicit user_id if not extracted from auth token")


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone_number: Optional[str] = Field(None, min_length=5, max_length=25)
    relationship_label: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    is_primary: Optional[bool] = None


class ContactResponse(ContactBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
