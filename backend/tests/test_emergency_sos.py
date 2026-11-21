import pytest
from app.models.alert import AlertStatus


# ==============================================================================
# 1. User Registration Tests
# ==============================================================================

def test_user_registration_success(client):
    payload = {
        "full_name": "Jane Rescuer",
        "phone_number": "+1 (555) 987-6543",
        "email": "jane.rescuer@test.org",
        "password": "EmergencySecret2026",
        "blood_group": "O-",
        "allergies": "Aspirin",
        "medical_notes": "None",
        "emergency_pin": "4321",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["full_name"] == payload["full_name"]
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["blood_group"] == "O-"
    assert "id" in data["user"]


def test_user_registration_duplicate_email(client, auth_user):
    duplicate_payload = {
        "full_name": "Imposter User",
        "phone_number": "+1 (555) 000-1111",
        "email": auth_user["payload"]["email"],  # Same email
        "password": "password123",
    }
    response = client.post("/api/v1/auth/register", json=duplicate_payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


# ==============================================================================
# 2. User Login Tests
# ==============================================================================

def test_user_login_success_via_email(client, auth_user):
    login_payload = {
        "identifier": auth_user["payload"]["email"],
        "password": auth_user["payload"]["password"],
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["id"] == auth_user["user_id"]


def test_user_login_success_via_phone(client, auth_user):
    login_payload = {
        "identifier": auth_user["payload"]["phone_number"],
        "password": auth_user["payload"]["password"],
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == auth_user["user_id"]


def test_user_login_invalid_password(client, auth_user):
    login_payload = {
        "identifier": auth_user["payload"]["email"],
        "password": "WrongPassword!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Incorrect email/phone or password" in response.json()["detail"]


# ==============================================================================
# 3. Add Emergency Contacts Tests
# ==============================================================================

def test_add_emergency_contact_success(client, auth_user):
    contact_payload = {
        "name": "Sarah Morgan",
        "phone_number": "+1 (555) 234-5678",
        "relationship_label": "Spouse",
        "email": "sarah@example.com",
        "is_primary": True,
    }
    response = client.post(
        "/api/v1/contacts/",
        json=contact_payload,
        headers=auth_user["headers"],
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == contact_payload["name"]
    assert data["phone_number"] == contact_payload["phone_number"]
    assert data["is_primary"] is True
    assert data["user_id"] == auth_user["user_id"]


def test_add_primary_contact_reassigns_previous(client, auth_user):
    # Add first primary contact
    c1 = client.post(
        "/api/v1/contacts/",
        json={"name": "First Contact", "phone_number": "555-0001", "is_primary": True},
        headers=auth_user["headers"],
    ).json()

    # Add second primary contact
    c2 = client.post(
        "/api/v1/contacts/",
        json={"name": "Second Contact", "phone_number": "555-0002", "is_primary": True},
        headers=auth_user["headers"],
    ).json()

    # Verify second contact is primary and first was unset
    list_res = client.get("/api/v1/contacts/", headers=auth_user["headers"])
    contacts = list_res.json()
    c1_updated = next(c for c in contacts if c["id"] == c1["id"])
    c2_updated = next(c for c in contacts if c["id"] == c2["id"])

    assert c2_updated["is_primary"] is True
    assert c1_updated["is_primary"] is False


# ==============================================================================
# 4. Remove Emergency Contacts Tests
# ==============================================================================

def test_remove_emergency_contact_success(client, auth_user):
    # Add a contact
    contact = client.post(
        "/api/v1/contacts/",
        json={"name": "Temporary Contact", "phone_number": "555-9999", "is_primary": False},
        headers=auth_user["headers"],
    ).json()

    # Delete the contact
    delete_res = client.delete(
        f"/api/v1/contacts/{contact['id']}",
        headers=auth_user["headers"],
    )
    assert delete_res.status_code == 200

    # Verify contact is gone
    list_res = client.get("/api/v1/contacts/", headers=auth_user["headers"])
    assert all(c["id"] != contact["id"] for c in list_res.json())


def test_remove_nonexistent_contact(client, auth_user):
    response = client.delete("/api/v1/contacts/999999", headers=auth_user["headers"])
    assert response.status_code == 404


# ==============================================================================
# 5. Create SOS Alerts Tests
# ==============================================================================

def test_create_sos_alert_success(client, auth_user):
    alert_payload = {
        "latitude": 37.78825,
        "longitude": -122.4324,
        "accuracy": 5.2,
        "address": "742 Montgomery St, San Francisco, CA",
        "message": "EMERGENCY: User pressed panic button!",
    }
    response = client.post(
        "/api/v1/sos/trigger",
        json=alert_payload,
        headers=auth_user["headers"],
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == AlertStatus.TRIGGERED
    assert data["user_id"] == auth_user["user_id"]
    assert data["latitude"] == pytest.approx(37.78825)
    assert data["longitude"] == pytest.approx(-122.4324)
    assert "triggered_at" in data


def test_create_sos_invalid_coordinates(client, auth_user):
    invalid_payload = {
        "latitude": 95.0,  # Invalid (>90)
        "longitude": -122.4324,
    }
    response = client.post(
        "/api/v1/sos/trigger",
        json=invalid_payload,
        headers=auth_user["headers"],
    )
    assert response.status_code == 422  # Pydantic validation error


# ==============================================================================
# 6. Save GPS Coordinates (Breadcrumb) Tests
# ==============================================================================

def test_save_gps_coordinates_success(client, auth_user):
    # 1. Create alert first
    alert = client.post(
        "/api/v1/sos/trigger",
        json={"latitude": 37.78825, "longitude": -122.4324},
        headers=auth_user["headers"],
    ).json()

    # 2. Append GPS breadcrumb
    breadcrumb_payload = {
        "alert_id": alert["id"],
        "latitude": 37.78910,
        "longitude": -122.4318,
        "accuracy": 4.1,
        "speed": 1.4,
        "heading": 90.0,
    }
    res = client.post("/api/v1/location/breadcrumb", json=breadcrumb_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["alert_id"] == alert["id"]
    assert data["latitude"] == pytest.approx(37.78910)
    assert "recorded_at" in data

    # 3. Retrieve breadcrumbs list
    list_res = client.get(f"/api/v1/location/alert/{alert['id']}/breadcrumbs")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


# ==============================================================================
# 7. Fetch Emergency History Tests
# ==============================================================================

def test_fetch_emergency_history(client, auth_user):
    # Create two alerts
    client.post(
        "/api/v1/sos/trigger",
        json={"latitude": 37.78825, "longitude": -122.4324},
        headers=auth_user["headers"],
    )
    alert2 = client.post(
        "/api/v1/sos/trigger",
        json={"latitude": 37.78830, "longitude": -122.4320},
        headers=auth_user["headers"],
    ).json()

    # Cancel alert2
    client.patch(
        f"/api/v1/sos/{alert2['id']}/cancel",
        json={"reason": "False alarm test"},
        headers=auth_user["headers"],
    )

    # Fetch all history
    history_res = client.get("/api/v1/sos/history", headers=auth_user["headers"])
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 2

    # Fetch only CANCELLED history
    filtered_res = client.get(
        "/api/v1/sos/history?status_filter=CANCELLED",
        headers=auth_user["headers"],
    )
    assert filtered_res.status_code == 200
    filtered = filtered_res.json()
    assert len(filtered) == 1
    assert filtered[0]["id"] == alert2["id"]


# ==============================================================================
# 8. Cancel Emergency Alerts Tests
# ==============================================================================

def test_cancel_emergency_alert_success(client, auth_user):
    # 1. Trigger alert
    alert = client.post(
        "/api/v1/sos/trigger",
        json={"latitude": 37.78825, "longitude": -122.4324},
        headers=auth_user["headers"],
    ).json()

    # 2. Cancel alert
    cancel_payload = {
        "reason": "Accidental pocket press. Safe.",
        "pin": "9999",
    }
    cancel_res = client.patch(
        f"/api/v1/sos/{alert['id']}/cancel",
        json=cancel_payload,
        headers=auth_user["headers"],
    )
    assert cancel_res.status_code == 200
    data = cancel_res.json()
    assert data["status"] == AlertStatus.CANCELLED
    assert data["cancellation_reason"] == cancel_payload["reason"]
    assert data["resolved_at"] is not None

    # 3. Verify no active alert remains
    active_res = client.get("/api/v1/sos/active", headers=auth_user["headers"])
    assert active_res.status_code == 200
    assert active_res.json() is None


# ==============================================================================
# 9. Authenticated vs. Unauthenticated Access Tests
# ==============================================================================

def test_get_current_user_profile_authenticated(client, auth_user):
    """GET /api/v1/auth/me returns the profile for a valid Bearer token."""
    response = client.get("/api/v1/auth/me", headers=auth_user["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == auth_user["user_id"]
    assert data["email"] == auth_user["payload"]["email"]
    assert data["full_name"] == auth_user["payload"]["full_name"]


def test_get_current_user_profile_unauthenticated(client):
    """GET /api/v1/auth/me returns 401 when no token is provided."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Could not validate authentication credentials" in response.json()["detail"]


def test_get_current_user_profile_invalid_token(client):
    """GET /api/v1/auth/me returns 401 when an invalid token is provided."""
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401


# ==============================================================================
# 10. Emergency Contacts CRUD (Create, List, Update/Delete)
# ==============================================================================

def test_contacts_crud_lifecycle(client, auth_user):
    """Verify complete CRUD lifecycle: create, list, and delete."""
    # 1. Create contact (testing both with and without trailing slash)
    create_payload = {
        "name": "Dr. Marcus Brody",
        "phone_number": "+1 (555) 444-3322",
        "relationship_label": "Physician",
        "email": "brody@hospital.org",
        "is_primary": False,
    }
    create_res = client.post(
        "/api/v1/contacts",
        json=create_payload,
        headers=auth_user["headers"],
    )
    assert create_res.status_code == 201
    contact = create_res.json()
    contact_id = contact["id"]
    assert contact["name"] == create_payload["name"]
    assert contact["user_id"] == auth_user["user_id"]

    # 2. List contacts (testing both without trailing slash and with trailing slash)
    list_res_no_slash = client.get("/api/v1/contacts", headers=auth_user["headers"])
    assert list_res_no_slash.status_code == 200
    list_res = client.get("/api/v1/contacts/", headers=auth_user["headers"])
    assert list_res.status_code == 200
    contact_ids = [c["id"] for c in list_res.json()]
    assert contact_id in contact_ids

    # 3. Update contact via PATCH /api/v1/contacts/{contact_id}
    patch_res = client.patch(
        f"/api/v1/contacts/{contact_id}",
        json={"relationship_label": "Chief Physician", "is_primary": True},
        headers=auth_user["headers"],
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["relationship_label"] == "Chief Physician"
    assert patch_res.json()["is_primary"] is True

    # 4. List contacts by user ID endpoint
    by_user_res = client.get(f"/api/v1/contacts/user/{auth_user['user_id']}")
    assert by_user_res.status_code == 200
    assert any(c["id"] == contact_id for c in by_user_res.json())

    # 5. Delete contact
    del_res = client.delete(f"/api/v1/contacts/{contact_id}", headers=auth_user["headers"])
    assert del_res.status_code == 200
    assert del_res.json()["id"] == contact_id

    # 6. Verify deleted from list
    post_del_res = client.get("/api/v1/contacts/", headers=auth_user["headers"])
    assert all(c["id"] != contact_id for c in post_del_res.json())


def test_contacts_unauthenticated_without_user_id_fails(client):
    """GET and POST /api/v1/contacts/ require authentication or explicit user_id."""
    res_get = client.get("/api/v1/contacts/")
    assert res_get.status_code == 400
    assert "Authentication required" in res_get.json()["detail"]

    res_post = client.post(
        "/api/v1/contacts/",
        json={"name": "No Auth", "phone_number": "1234567"},
    )
    assert res_post.status_code == 400


# ==============================================================================
# 11. Location Breadcrumbs during Active vs. Cancelled Alert
# ==============================================================================

def test_location_breadcrumbs_active_and_retrieval(client, auth_user):
    """Test location breadcrumb creation, streaming, and retrieval during an active alert."""
    # 1. Trigger alert
    alert = client.post(
        "/api/v1/sos/trigger",
        json={"latitude": 37.7749, "longitude": -122.4194, "message": "Tracking test"},
        headers=auth_user["headers"],
    ).json()
    alert_id = alert["id"]

    # 2. Stream first breadcrumb
    b1 = client.post(
        "/api/v1/location/breadcrumb",
        json={
            "alert_id": alert_id,
            "latitude": 37.7752,
            "longitude": -122.4190,
            "accuracy": 3.0,
            "speed": 2.5,
            "heading": 45.0,
        },
    )
    assert b1.status_code == 201

    # 3. Stream second breadcrumb
    b2 = client.post(
        "/api/v1/location/breadcrumb",
        json={
            "alert_id": alert_id,
            "latitude": 37.7758,
            "longitude": -122.4185,
            "accuracy": 2.5,
            "speed": 3.1,
            "heading": 50.0,
        },
    )
    assert b2.status_code == 201

    # 4. Retrieve breadcrumb list for alert
    breadcrumbs_res = client.get(f"/api/v1/location/alert/{alert_id}/breadcrumbs")
    assert breadcrumbs_res.status_code == 200
    breadcrumbs = breadcrumbs_res.json()
    assert len(breadcrumbs) == 2
    assert breadcrumbs[0]["latitude"] == pytest.approx(37.7752)
    assert breadcrumbs[1]["latitude"] == pytest.approx(37.7758)

    # 5. Retrieve alert detail which embeds breadcrumbs
    detail_res = client.get(f"/api/v1/sos/{alert_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["breadcrumbs"]) == 2
    assert detail["contacts_notified_count"] >= 0

    # 6. Cancel the alert
    cancel_res = client.patch(
        f"/api/v1/sos/{alert_id}/cancel",
        json={"reason": "Emergency resolved by first responders"},
        headers=auth_user["headers"],
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == AlertStatus.CANCELLED

    # 7. Attempting to add breadcrumbs to cancelled alert must fail with 400
    b_cancelled = client.post(
        "/api/v1/location/breadcrumb",
        json={
            "alert_id": alert_id,
            "latitude": 37.7760,
            "longitude": -122.4180,
        },
    )
    assert b_cancelled.status_code == 400
    assert "Cannot append telemetry to an alert in" in b_cancelled.json()["detail"]
    assert "CANCELLED" in b_cancelled.json()["detail"]


def test_breadcrumb_nonexistent_alert(client):
    """POST to /location/breadcrumb for non-existent alert returns 404."""
    response = client.post(
        "/api/v1/location/breadcrumb",
        json={"alert_id": 999999, "latitude": 37.7749, "longitude": -122.4194},
    )
    assert response.status_code == 404


# ==============================================================================
# 12. Nearby Emergency Services (Police & Hospitals) Tests
# ==============================================================================

def test_nearby_services_validation(client):
    """GET /location/nearby-services validates latitude and longitude coordinates."""
    # Missing required query params
    res_missing = client.get("/api/v1/location/nearby-services")
    assert res_missing.status_code == 422

    # Invalid latitude
    res_invalid = client.get("/api/v1/location/nearby-services?lat=95.0&lng=-122.4194")
    assert res_invalid.status_code == 422


@pytest.mark.asyncio
async def test_nearby_services_mocked_osm(client, monkeypatch):
    """GET /location/nearby-services formats and returns police and hospitals sorted by distance."""
    from app.services.location_service import location_service

    sample_mock_data = [
        {
            "id": "osm-node-1001",
            "name": "Central Police Station",
            "category": "police",
            "latitude": 37.7750,
            "longitude": -122.4190,
            "distance_km": 0.35,
            "address": "123 Justice Way, City Center",
        },
        {
            "id": "osm-way-2002",
            "name": "St. Jude Emergency Hospital",
            "category": "hospital",
            "latitude": 37.7780,
            "longitude": -122.4150,
            "distance_km": 0.85,
            "address": "456 Healing Blvd",
        },
    ]

    async def mock_fetch(*args, **kwargs):
        return sample_mock_data

    monkeypatch.setattr(location_service, "fetch_nearby_services_from_osm", mock_fetch)

    response = client.get("/api/v1/location/nearby-services?lat=37.7749&lng=-122.4194&radius_m=3000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Central Police Station"
    assert data[0]["category"] == "police"
    assert data[0]["distance_km"] == 0.35
    assert data[1]["name"] == "St. Jude Emergency Hospital"
    assert data[1]["category"] == "hospital"
    assert data[1]["distance_km"] == 0.85


@pytest.mark.asyncio
async def test_nearby_services_overpass_timeout_returns_503(client, monkeypatch):
    """GET /location/nearby-services returns HTTP 503 when Overpass API times out."""
    import httpx
    from app.services.location_service import location_service

    async def mock_timeout(*args, **kwargs):
        raise httpx.TimeoutException("Overpass request timed out")

    monkeypatch.setattr(location_service, "fetch_nearby_services_from_osm", mock_timeout)

    response = client.get("/api/v1/location/nearby-services?lat=37.7749&lng=-122.4194")
    assert response.status_code == 503
    assert "temporarily unreachable or timed out" in response.json()["detail"]


