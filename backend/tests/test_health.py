def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "version" in data


def test_health_check_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "connected"


def test_root_health_alias_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_api_v1_root_endpoint(client):
    res_slash = client.get("/api/v1/")
    assert res_slash.status_code == 200
    assert res_slash.json()["status"] == "online"

    res_no_slash = client.get("/api/v1")
    assert res_no_slash.status_code == 200
    assert res_no_slash.json()["status"] == "online"
