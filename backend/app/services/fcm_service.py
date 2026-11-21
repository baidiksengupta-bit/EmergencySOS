"""
Firebase Cloud Messaging (FCM) Integration Service.
Strict rule: Never report successful delivery unless the provider
confirms acceptance or delivery.
"""

import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("emergency_sos.fcm")


class FCMNotificationService:
    def __init__(self):
        self.is_initialized = False
        self._initialize_firebase()

    def _initialize_firebase(self):
        if settings.FIREBASE_CREDENTIALS_PATH:
            try:
                import firebase_admin
                from firebase_admin import credentials
                if not firebase_admin._apps:
                    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                    firebase_admin.initialize_app(cred)
                self.is_initialized = True
                logger.info("Firebase Admin SDK successfully initialized.")
            except Exception as e:
                logger.warning(f"Firebase initialization failed: {e}. Running in dry-run mode.")
        else:
            logger.info("FIREBASE_CREDENTIALS_PATH not configured.")

    async def send_sos_alert(
        self,
        tokens: List[str],
        alert_id: int,
        user_name: str,
        latitude: float,
        longitude: float,
        google_maps_url: str,
    ) -> Dict[str, Any]:
        """
        Send high-priority emergency push notification.
        Returns strict delivery report - never reports SUCCESS unless provider confirms.
        """
        if not tokens:
            return {
                "provider": "firebase_fcm",
                "delivery_status": "NO_RECIPIENTS",
                "confirmed_count": 0,
                "failed_count": 0,
                "recipient_count": 0,
                "details": "No emergency contacts or push tokens registered for user.",
                "google_maps_url": google_maps_url,
            }

        payload = {
            "title": f"🚨 EMERGENCY: {user_name} activated SOS!",
            "body": f"Urgent help requested at ({latitude:.5f}, {longitude:.5f}). Live Map: {google_maps_url}",
            "data": {
                "alert_id": str(alert_id),
                "type": "SOS_TRIGGER",
                "latitude": str(latitude),
                "longitude": str(longitude),
                "maps_url": google_maps_url,
            },
        }

        if self.is_initialized:
            try:
                from firebase_admin import messaging
                message = messaging.MulticastMessage(
                    notification=messaging.Notification(
                        title=payload["title"],
                        body=payload["body"],
                    ),
                    data=payload["data"],
                    tokens=tokens,
                    android=messaging.AndroidConfig(priority="high"),
                    apns=messaging.APNSConfig(
                        payload=messaging.APNSPayload(
                            aps=messaging.Aps(sound="default", content_available=True)
                        )
                    ),
                )
                response = messaging.send_multicast(message)
                if response.success_count > 0:
                    status = "ACCEPTED"
                    details = f"Provider confirmed {response.success_count}/{len(tokens)} message acceptances."
                else:
                    status = "FAILED"
                    details = f"Provider rejected all {response.failure_count} message deliveries."

                return {
                    "provider": "firebase_fcm",
                    "delivery_status": status,
                    "confirmed_count": response.success_count,
                    "failed_count": response.failure_count,
                    "recipient_count": len(tokens),
                    "details": details,
                    "google_maps_url": google_maps_url,
                }
            except Exception as ex:
                logger.error(f"FCM multicast dispatch error: {ex}")
                return {
                    "provider": "firebase_fcm",
                    "delivery_status": "FAILED",
                    "confirmed_count": 0,
                    "failed_count": len(tokens),
                    "recipient_count": len(tokens),
                    "details": f"FCM provider error: {str(ex)}",
                    "google_maps_url": google_maps_url,
                }

        # If FCM credentials are not configured on server:
        logger.warning("FCM credentials not configured. Notification not dispatched.")
        return {
            "provider": "firebase_fcm",
            "delivery_status": "UNCONFIGURED",
            "confirmed_count": 0,
            "failed_count": len(tokens),
            "recipient_count": len(tokens),
            "details": "FCM credentials unconfigured on backend server. Cellular SMS fallback required.",
            "google_maps_url": google_maps_url,
        }


fcm_service = FCMNotificationService()
