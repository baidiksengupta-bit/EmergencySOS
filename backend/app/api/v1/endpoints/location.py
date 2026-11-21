from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.alert import SOSAlert, AlertStatus
from app.models.location_log import LocationBreadcrumb
from app.schemas.location import LocationBreadcrumbCreate, LocationBreadcrumbResponse

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
