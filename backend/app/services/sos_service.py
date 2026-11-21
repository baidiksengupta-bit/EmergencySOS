"""
Orchestration service for SOS alerts.
Coordinates saving the alert to DB and notifying emergency contacts.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.alert import SOSAlert, AlertStatus
from app.models.user import User
from app.schemas.alert import AlertCreate
from app.services.fcm_service import fcm_service


class SOSService:
    @staticmethod
    async def trigger_emergency_alert(db: Session, alert_in: AlertCreate) -> SOSAlert:
        # 1. Create alert record
        alert = SOSAlert(
            user_id=alert_in.user_id,
            status=AlertStatus.TRIGGERED,
            latitude=alert_in.latitude,
            longitude=alert_in.longitude,
            accuracy=alert_in.accuracy,
            address=alert_in.address,
            message=alert_in.message,
            triggered_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        # 2. Collect contacts' FCM tokens or phone numbers
        user = db.query(User).filter(User.id == alert_in.user_id).first()
        user_name = user.full_name if user else "A user"

        # 3. Broadcast notification
        await fcm_service.send_sos_alert(
            tokens=[],  # In real flow, query contacts or responder tokens
            alert_id=alert.id,
            user_name=user_name,
            latitude=alert.latitude,
            longitude=alert.longitude,
        )

        return alert


sos_service = SOSService()
