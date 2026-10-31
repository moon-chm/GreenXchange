import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core.request_logging import log_requests


ORIGIN = "https://greenxchange-frontend-dtf0.onrender.com"


def client():
    app = FastAPI()
    app.middleware("http")(log_requests)
    app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_credentials=True,
                       allow_methods=["POST"], allow_headers=["Authorization", "Content-Type"],
                       expose_headers=["X-Request-ID"])

    @app.post("/recommendations/")
    async def failure():
        raise RuntimeError("private database failure")

    @app.get("/protected")
    async def protected():
        raise HTTPException(401, "Not authenticated")

    @app.get("/healthy")
    async def healthy():
        return {"ok": True}

    return TestClient(app)


def test_server_failure_is_readable_by_frontend_and_logged(caplog):
    with caplog.at_level(logging.ERROR):
        response = client().post("/recommendations/", headers={"Origin": ORIGIN})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    assert response.json()["request_id"] == response.headers["x-request-id"]
    assert "private database failure" not in response.text
    assert "private database failure" in caplog.text
    assert response.headers["x-request-id"] in caplog.text


def test_untrusted_origin_is_not_allowed_on_errors():
    response = client().post("/recommendations/", headers={"Origin": "https://untrusted.example"})
    assert response.status_code == 500
    assert "access-control-allow-origin" not in response.headers


def test_auth_errors_and_success_responses_keep_their_status():
    for path, status, body in [("/protected", 401, {"detail": "Not authenticated"}),
                               ("/healthy", 200, {"ok": True})]:
        response = client().get(path, headers={"Origin": ORIGIN})
        assert response.status_code == status
        assert response.json() == body
        assert response.headers["access-control-allow-origin"] == ORIGIN
        assert response.headers["x-request-id"]
