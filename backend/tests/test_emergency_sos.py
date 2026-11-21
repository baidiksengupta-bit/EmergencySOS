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
