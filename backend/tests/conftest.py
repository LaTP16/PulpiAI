import pytest
import os
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db
from app.database.seed_data import seed_demo_data_if_needed

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()
    seed_demo_data_if_needed()

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
