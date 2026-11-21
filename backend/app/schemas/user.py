from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120, description="User full legal name")
    phone_number: str = Field(..., min_length=7, max_length=25, description="Primary mobile phone")
    email: EmailStr = Field(..., description="Unique email address")
    blood_group: Optional[str] = Field("O+", max_length=10, description="Blood type for emergency relay")
    allergies: Optional[str] = Field(None, max_length=500, description="Known drug/food allergies")
    medical_notes: Optional[str] = Field(None, max_length=1000, description="Chronic medical notes")


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=100, description="Account password (min 6 chars)")
    emergency_pin: Optional[str] = Field("1234", min_length=4, max_length=10, description="4-digit cancel PIN")


class UserLogin(BaseModel):
    identifier: str = Field(..., description="Registered email or phone number")
    password: str = Field(..., description="Account password")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone_number: Optional[str] = Field(None, min_length=7, max_length=25)
    email: Optional[EmailStr] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_pin: Optional[str] = None
    fcm_token: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    emergency_pin: Optional[str] = None
    fcm_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
