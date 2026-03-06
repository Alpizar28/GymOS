"""Supabase JWT verification and per-request user context."""

from __future__ import annotations

import contextvars
import time
from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from src.config import settings

_current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_id",
    default=None,
)


@dataclass(slots=True)
class AuthUser:
    user_id: str


_jwk_client: PyJWKClient | None = None
_jwk_client_expiry = 0.0


def _jwks_url() -> str:
    base = settings.supabase_url.rstrip("/")
    if not base:
        return ""
    return f"{base}/auth/v1/.well-known/jwks.json"


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    global _jwk_client_expiry

    now = time.time()
    if _jwk_client is not None and now < _jwk_client_expiry:
        return _jwk_client

    jwks_url = _jwks_url()
    if not jwks_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is not configured")

    _jwk_client = PyJWKClient(jwks_url)
    _jwk_client_expiry = now + 300
    return _jwk_client


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[7:].strip() or None


def _set_user_context(user_id: str) -> None:
    _current_user_id.set(user_id)


def get_current_user_id() -> str:
    user_id = _current_user_id.get()
    if not user_id and not settings.auth_enabled:
        return settings.dev_fallback_user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def clear_current_user_id() -> None:
    _current_user_id.set(None)


def authenticate_request(request: Request) -> AuthUser:
    if request.url.path == "/api/health":
        _set_user_context("system")
        return AuthUser(user_id="system")

    if not settings.auth_enabled:
        fallback = settings.dev_fallback_user_id.strip() or "00000000-0000-0000-0000-000000000001"
        _set_user_context(fallback)
        return AuthUser(user_id=fallback)

    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    jwk_client = _get_jwk_client()
    try:
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_audience,
            options={"verify_signature": True, "verify_exp": True},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    sub = str(payload.get("sub") or "").strip()
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    _set_user_context(sub)
    return AuthUser(user_id=sub)
