import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # Register all models
from app.core.database import Base, get_db
from app.main import app

# Use in-memory SQLite with StaticPool for test isolation
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_user(client):
    """Registers a sample user and returns registration payload + token."""
    user_payload = {
        "full_name": "Test Guardian",
        "phone_number": "+1 (555) 123-4567",
        "email": "guardian@emergency.org",
        "password": "SecurePassword123!",
        "blood_group": "A+",
        "allergies": "None",
        "medical_notes": "Healthy",
        "emergency_pin": "9999",
    }
    response = client.post("/api/v1/auth/register", json=user_payload)
    assert response.status_code == 201
    data = response.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "user_id": user_id,
        "token": token,
        "headers": headers,
        "payload": user_payload,
    }
