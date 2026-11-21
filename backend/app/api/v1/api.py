from fastapi import APIRouter
from app.api.v1.endpoints import auth, contacts, sos, location, health

api_router = APIRouter()


@api_router.get("/", tags=["System Health"])
@api_router.get("", include_in_schema=False)
def api_v1_root():
    return {"status": "online", "message": "EmergencySOS API v1"}


# Register core endpoint routers
api_router.include_router(health.router, tags=["System Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["User Authentication"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Emergency Contacts"])
api_router.include_router(sos.router, prefix="/sos", tags=["Emergency SOS"])
api_router.include_router(location.router, prefix="/location", tags=["Live Location & GPS"])
