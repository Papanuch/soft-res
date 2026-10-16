import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SOFTRES_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from soft_res import config, db

    config.settings.cache_clear()
    db.reset_engine()
    from soft_res.app import create_app

    with TestClient(create_app()) as c:
        yield c
    db.reset_engine()
    config.settings.cache_clear()
