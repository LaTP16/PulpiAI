from app.core.config import settings

def test_demo_credentials_endpoint(client):
    res = client.get("/api/auth/demo-credentials")
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "maria@gmail.com"
    assert data["password"] == "comerciante123"
    assert data["is_demo_mode"] is True

def test_login_with_demo_credentials(client):
    res = client.post("/api/auth/login", json={
        "identifier": settings.DEMO_USER_EMAIL,
        "password": settings.DEMO_USER_PASSWORD
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["email"] == "maria@gmail.com"
    assert data["user"]["is_demo"] is True
    assert "token" in data

def test_login_with_demo_phone(client):
    res = client.post("/api/auth/login", json={
        "identifier": settings.DEMO_USER_PHONE,
        "password": settings.DEMO_USER_PASSWORD
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["name"] == "María Rodríguez"

def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={
        "identifier": "maria@gmail.com",
        "password": "wrong_password"
    })
    assert res.status_code == 401
