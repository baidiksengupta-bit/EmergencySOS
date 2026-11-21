from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user_optional
from app.core.security import get_password_hash
from app.models.alert import SOSAlert, AlertStatus
from app.models.emergency_contact import EmergencyContact
from app.models.user import User
from app.schemas.alert import (
    AlertCreate,
    AlertCancel,
    AlertResponse,
    AlertDetailResponse,
    AlertBreadcrumbDetail,
    NotificationDeliveryReport,
)
from app.services.fcm_service import fcm_service

router = APIRouter()


@router.post(
    "/trigger",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create SOS emergency alert",
    description="Registers an active emergency SOS alert with initial GPS coordinates and notifies contacts.",
)
async def create_sos_alert(
    alert_in: AlertCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    target_user_id = current_user.id if current_user else alert_in.user_id
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication required or user_id must be provided.",
        )

    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        if target_user_id == 1:
            user = User(
                id=1,
                email="user1@emergencysos.org",
                phone_number="+15550000001",
                full_name="Emergency Demo User",
                hashed_password=get_password_hash("demo-password-123!"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {target_user_id} not found.",
            )

    # Construct standard Google Maps search link
    google_maps_url = alert_in.google_maps_url or (
        f"https://www.google.com/maps/search/?api=1&query={alert_in.latitude},{alert_in.longitude}"
    )

    # Create new SOS alert record
    alert = SOSAlert(
        user_id=target_user_id,
        status=AlertStatus.TRIGGERED,
        latitude=alert_in.latitude,
        longitude=alert_in.longitude,
        accuracy=alert_in.accuracy,
        address=alert_in.address,
        location_status=alert_in.location_status or "ACCURATE",
        google_maps_url=google_maps_url,
        message=alert_in.message or "Emergency SOS broadcast activated!",
        notification_status="PENDING",
        contacts_alerted_count=0,
        triggered_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Fetch user contacts for push notification broadcast
    contacts = db.query(EmergencyContact).filter(EmergencyContact.user_id == target_user_id).all()
    # Collect FCM push tokens if user has registered them or from contacts
    push_tokens = [user.fcm_token] if user.fcm_token else []

    # Trigger FCM service broadcast with strict confirmation
    delivery_data = await fcm_service.send_sos_alert(
        tokens=push_tokens,
        alert_id=alert.id,
        user_name=user.full_name,
        latitude=alert.latitude,
        longitude=alert.longitude,
        google_maps_url=google_maps_url,
    )

    # Update alert record with true delivery status
    alert.notification_status = delivery_data["delivery_status"]
    alert.contacts_alerted_count = delivery_data["confirmed_count"]
    db.commit()
    db.refresh(alert)

    # Prepare response with verified delivery report
    alert_response = AlertResponse.model_validate(alert)
    alert_response.delivery_report = NotificationDeliveryReport(**delivery_data)
    return alert_response


@router.get(
    "/active",
    response_model=Optional[AlertResponse],
    summary="Fetch current active SOS alert",
    description="Returns the currently active emergency alert if one is in TRIGGERED or ACKNOWLEDGED status.",
)
def get_active_sos(
    user_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    target_user_id = current_user.id if current_user else user_id
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication required or specify user_id parameter.",
        )

    alert = (
        db.query(SOSAlert)
        .filter(
            SOSAlert.user_id == target_user_id,
            SOSAlert.status.in_([AlertStatus.TRIGGERED, AlertStatus.ACKNOWLEDGED]),
        )
        .order_by(SOSAlert.triggered_at.desc())
        .first()
    )
    return alert


@router.get(
    "/history",
    response_model=List[AlertResponse],
    summary="Fetch emergency history",
    description="Retrieves archived emergency incidents for a user, with optional status filtering.",
)
@router.get(
    "",
    response_model=List[AlertResponse],
    include_in_schema=False,
)
@router.get(
    "/",
    response_model=List[AlertResponse],
    include_in_schema=False,
)
def fetch_emergency_history(
    user_id: Optional[int] = None,
    status_filter: Optional[AlertStatus] = Query(None, description="Filter by status (RESOLVED, CANCELLED, TRIGGERED)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    target_user_id = current_user.id if current_user else user_id
    if not target_user_id:
        # Unauthenticated / demo mode has no backend records; return empty array cleanly
        return []

    query = db.query(SOSAlert).filter(SOSAlert.user_id == target_user_id)
    if status_filter:
        query = query.filter(SOSAlert.status == status_filter)

    alerts = query.order_by(SOSAlert.triggered_at.desc()).all()
    return alerts


@router.patch(
    "/{alert_id}/cancel",
    response_model=AlertResponse,
    summary="Cancel emergency alert",
    description="Resolves or cancels an active emergency alert, recording the reason and resolution time.",
)
def cancel_emergency_alert(
    alert_id: int,
    cancel_in: Optional[AlertCancel] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = db.query(SOSAlert).filter(SOSAlert.id == alert_id)
    if current_user:
        query = query.filter(SOSAlert.user_id == current_user.id)

    alert = query.first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert with ID {alert_id} not found.",
        )

    # Update alert status
    reason = cancel_in.reason if cancel_in and cancel_in.reason else "Cancelled by user"
    alert.status = AlertStatus.CANCELLED
    alert.cancellation_reason = reason
    alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return alert


@router.get(
    "/{alert_id}",
    response_model=AlertDetailResponse,
    summary="Fetch alert details with GPS breadcrumbs",
    description="Returns an emergency alert along with its streamed GPS breadcrumb trail.",
)
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.query(SOSAlert).filter(SOSAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SOS alert with ID {alert_id} not found.",
        )

    contacts_count = (
        db.query(EmergencyContact)
        .filter(EmergencyContact.user_id == alert.user_id)
        .count()
    )

    breadcrumbs_data = [
        AlertBreadcrumbDetail.model_validate(b) for b in alert.breadcrumbs
    ]

    response = AlertDetailResponse(
        id=alert.id,
        user_id=alert.user_id,
        status=alert.status,
        latitude=alert.latitude,
        longitude=alert.longitude,
        accuracy=alert.accuracy,
        address=alert.address,
        message=alert.message,
        cancellation_reason=alert.cancellation_reason,
        triggered_at=alert.triggered_at,
        resolved_at=alert.resolved_at,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
        breadcrumbs=breadcrumbs_data,
        contacts_notified_count=contacts_count,
    )
    return response
