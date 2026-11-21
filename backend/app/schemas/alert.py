from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.alert import AlertStatus


class NotificationDeliveryReport(BaseModel):
    provider: str = "firebase_fcm"
    delivery_status: str = Field(
        ...,
        description="ACCEPTED (provider confirmed acceptance), FAILED, UNCONFIGURED, NO_RECIPIENTS, or OFFLINE",
    )
    confirmed_count: int = 0
    failed_count: int = 0
    recipient_count: int = 0
    details: str
    google_maps_url: Optional[str] = None


class AlertBase(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude (-180 to +180)")
    accuracy: Optional[float] = Field(None, description="GPS Accuracy in meters")
    address: Optional[str] = Field(None, max_length=255, description="Reverse-geocoded street address")
    message: Optional[str] = Field("Emergency SOS broadcast activated!", max_length=500)
    location_status: Optional[str] = Field("ACCURATE", description="ACCURATE, DEGRADED, or UNAVAILABLE")
    google_maps_url: Optional[str] = Field(None, max_length=500, description="Google Maps location link")


class AlertCreate(AlertBase):
    user_id: Optional[int] = Field(None, description="User ID triggering the alert (auto-filled if authenticated)")


class AlertCancel(BaseModel):
    reason: Optional[str] = Field("False Alarm / Resolved", max_length=255, description="Cancellation notes")
    pin: Optional[str] = Field(None, max_length=10, description="Optional safety PIN confirmation")


class AlertResponse(AlertBase):
    id: int
    user_id: int
    status: AlertStatus
    notification_status: str = "PENDING"
    contacts_alerted_count: int = 0
    cancellation_reason: Optional[str] = None
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    delivery_report: Optional[NotificationDeliveryReport] = None

    model_config = ConfigDict(from_attributes=True)


class AlertBreadcrumbDetail(BaseModel):
    id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertDetailResponse(AlertResponse):
    breadcrumbs: List[AlertBreadcrumbDetail] = []
    contacts_notified_count: int = 0
