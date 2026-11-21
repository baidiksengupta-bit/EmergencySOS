from typing import List, Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import httpx

from app.api.deps import get_db
from app.models.alert import SOSAlert, AlertStatus
from app.models.location_log import LocationBreadcrumb
from app.schemas.location import (
    LocationBreadcrumbCreate,
    LocationBreadcrumbResponse,
    NearbyServiceResponse,
)
from app.services.location_service import location_service

logger = logging.getLogger("emergency_sos.location")

router = APIRouter()


@router.post(
    "/breadcrumb",
    response_model=LocationBreadcrumbResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save live GPS coordinates (breadcrumb)",
    description="Records a real-time GPS coordinate telemetry breadcrumb for an ongoing SOS alert.",
)
def save_gps_coordinates(
    breadcrumb_in: LocationBreadcrumbCreate,
    db: Session = Depends(get_db),
):
    # Verify that the referenced SOS alert exists
    alert = db.query(SOSAlert).filter(SOSAlert.id == breadcrumb_in.alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert with ID {breadcrumb_in.alert_id} does not exist.",
        )

    # Allow recording breadcrumbs if alert is active
    if alert.status in [AlertStatus.RESOLVED, AlertStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot append telemetry to an alert in {alert.status} status.",
        )

    breadcrumb = LocationBreadcrumb(
        alert_id=breadcrumb_in.alert_id,
        latitude=breadcrumb_in.latitude,
        longitude=breadcrumb_in.longitude,
        accuracy=breadcrumb_in.accuracy,
        speed=breadcrumb_in.speed,
        heading=breadcrumb_in.heading,
    )
    db.add(breadcrumb)

    # Also update alert's latest coordinates and address
    alert.latitude = breadcrumb_in.latitude
    alert.longitude = breadcrumb_in.longitude
    if breadcrumb_in.accuracy:
        alert.accuracy = breadcrumb_in.accuracy

    db.commit()
    db.refresh(breadcrumb)
    return breadcrumb


@router.get(
    "/alert/{alert_id}/breadcrumbs",
    response_model=List[LocationBreadcrumbResponse],
    summary="Get GPS breadcrumbs for alert",
    description="Returns all recorded GPS telemetry coordinates streamed during an emergency alert.",
)
def get_breadcrumbs(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert with ID {alert_id} does not exist.",
        )

    breadcrumbs = (
        db.query(LocationBreadcrumb)
        .filter(LocationBreadcrumb.alert_id == alert_id)
        .order_by(LocationBreadcrumb.recorded_at.asc())
        .all()
    )
    return breadcrumbs


@router.get(
    "/nearby-services",
    response_model=List[NearbyServiceResponse],
    summary="Discover nearby Police Stations & Hospitals",
    description="Queries OpenStreetMap Overpass API for nearby emergency facilities within a specified radius in meters.",
)
async def get_nearby_emergency_services(
    lat: float = Query(..., ge=-90.0, le=90.0, description="User current latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="User current longitude"),
    radius_m: int = Query(3000, ge=500, le=25000, description="Search radius in meters"),
):
    try:
        services = await location_service.fetch_nearby_services_from_osm(
            latitude=lat,
            longitude=lng,
            radius_m=radius_m,
        )
        return services
    except (httpx.TimeoutException, httpx.NetworkError) as net_err:
        logger.warning(f"Overpass API network/timeout error: {net_err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenStreetMap Overpass API is temporarily unreachable or timed out.",
        )
    except httpx.HTTPStatusError as http_err:
        logger.warning(f"Overpass API returned HTTP error: {http_err.response.status_code}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenStreetMap Overpass service returned status {http_err.response.status_code}.",
        )
    except Exception as exc:
        logger.error(f"Unexpected error querying nearby services: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while discovering nearby emergency services.",
        )
