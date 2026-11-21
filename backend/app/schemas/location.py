from datetime import datetime
from typing import Optional, Literal
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


class NearbyServiceResponse(BaseModel):
    id: str = Field(..., description="Unique OSM or generated identifier")
    name: str = Field(..., description="Facility name (e.g., Central Police Station, General Hospital)")
    category: Literal["police", "hospital"] = Field(..., description="Category of the facility")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    distance_km: float = Field(..., description="Distance in kilometers from user coordinate")
    address: Optional[str] = Field(None, description="Street address or locality description")

    model_config = ConfigDict(from_attributes=True)
