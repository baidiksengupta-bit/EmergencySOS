from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LocationBreadcrumbCreate(BaseModel):
    alert_id: int = Field(..., description="ID of the active SOS alert")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude")
    accuracy: Optional[float] = Field(None, description="Accuracy in meters")
    speed: Optional[float] = Field(None, description="Ground speed in m/s")
    heading: Optional[float] = Field(None, description="Direction heading in degrees")


class LocationBreadcrumbResponse(LocationBreadcrumbCreate):
    id: int
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)
