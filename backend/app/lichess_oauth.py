from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from threading import RLock

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

router = APIRouter(prefix="/api/lichess", tags=["Lichess OAuth"])

LICHESS_AUTHORIZE = "https://lichess.org/oauth"
LICHESS_TOKEN = "https://lichess.org/api/token"
LICHESS_EXPLORER = "https://explorer.lichess.ovh/lichess"
COOKIE_NAME = "chessbook_session"
STATE_COOKIE = "chessbook_oauth_state"
SESSION_TTL = 12 * 60 * 60
OAUTH_TTL = 10 * 60
LOCK = RLock()

# These maps are deliberately server-side. Never return access tokens to clients.
_sessions: dict[str, dict] = {}
_pending: dict[str, dict] = {}


def _setting(name: str) -> str:
    return os.environ.get(name, "").strip()


def _secret() -> bytes:
    value = _setting("CHESSBOOK_SESSION_SECRET")
    if len(value) < 32:
        raise HTTPException(
            status_code=503,
            detail="OAuth is not configured. Set CHESSBOOK_SESSION_SECRET.",
        )
    return value.encode("utf-8")


def _client_id() -> str:
    value = _setting("LICHESS_CLIENT_ID")
    if not value:
        raise HTTPException(
            status_code=503,
            detail="OAuth is not configured. Set LICHESS_CLIENT_ID.",
        )
    return value


def _callback_url(request: Request) -> str:
    configured = _setting("LICHESS_REDIRECT_URI")
    if configured:
        return configured
    # For local development, use the exact origin registered in Lichess.
    return str(request.base_url).rstrip("/") + "/api/lichess/callback"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign(session_id: str) -> str:
    digest = hmac.new(_secret(), session_id.encode(), hashlib.sha256).digest()
    return session_id + "." + _b64(digest)


def _read_session(request: Request) -> tuple[str, dict] | None:
    cookie = request.cookies.get(COOKIE_NAME, "")
    if "." not in cookie:
        return None
    session_id, signature = cookie.rsplit(".", 1)
    expected = _b64(hmac.new(_secret(), session_id.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    with LOCK:
        session = _sessions.get(session_id)
        if not session or session["expires"] < time.time():
            _sessions.pop(session_id, None)
            return None
        return session_id, session


def _cookie(response, session_id: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        _sign(session_id),
        httponly=True,
        secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
        samesite="lax",
        max_age=SESSION_TTL,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"


def _clear_cookie(response) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"


def _post_form(url: str, fields: dict[str, str]) -> dict:
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Accept": "application/json",
                 "Content-Type": "application/x-www-form-urlencoded",
                 "User-Agent": "ChessBookReader/0.1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read(128 * 1024))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise HTTPException(status_code=502, detail="Lichess authorization service is unavailable.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid response from Lichess.")
    return data


def _get_json(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url, method="GET",
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/json",
                 "User-Agent": "ChessBookReader/0.1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read(2 * 1024 * 1024))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(status_code=401, detail="Lichess authorization expired. Reconnect Lichess.") from exc
        if exc.code == 429:
            raise HTTPException(status_code=429, detail="Lichess rate limit reached. Try again shortly.") from exc
        raise HTTPException(status_code=502, detail="Lichess Opening Explorer request failed.") from exc
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise HTTPException(status_code=502, detail="Lichess Opening Explorer is unavailable.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid response from Lichess Opening Explorer.")
    return data


@router.get("/status")
def status(request: Request):
    # If the secret is not configured, return an explicit disconnected status.
    if len(_setting("CHESSBOOK_SESSION_SECRET")) < 32:
        return {"connected": False, "configured": False}
    try:
        session = _read_session(request)
    except HTTPException:
        return {"connected": False, "configured": False}
    return {"connected": bool(session and session[1].get("token")),
            "configured": bool(_setting("LICHESS_CLIENT_ID"))}


@router.get("/connect")
def connect(request: Request):
    client_id = _client_id()
    _secret()
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    browser_nonce = secrets.token_urlsafe(32)
    challenge = _b64(hashlib.sha256(verifier.encode()).digest())
    callback_url = _callback_url(request)

    with LOCK:
        _pending[state] = {
            "verifier": verifier,
            "browser_nonce": browser_nonce,
            "created": time.time(),
            "callback": callback_url,
        }
        for old_state, entry in list(_pending.items()):
            if time.time() - entry["created"] > OAUTH_TTL:
                _pending.pop(old_state, None)

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": callback_url,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
        "state": state,
    }
    response = RedirectResponse(
        LICHESS_AUTHORIZE + "?" + urllib.parse.urlencode(params),
        status_code=302,
    )
    response.set_cookie(
        STATE_COOKIE, browser_nonce,
        httponly=True,
        secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
        samesite="lax", max_age=OAUTH_TTL, path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/callback")
def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        response = RedirectResponse("/?lichess=denied", status_code=303)
        response.delete_cookie(
            STATE_COOKIE, path="/", httponly=True,
            secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
            samesite="lax",
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    if not code or not state:
        raise HTTPException(status_code=400, detail="Incomplete OAuth callback.")

    with LOCK:
        pending = _pending.pop(state, None)

    browser_nonce = request.cookies.get(STATE_COOKIE, "")
    if (
        not pending
        or time.time() - pending["created"] > OAUTH_TTL
        or not browser_nonce
        or not hmac.compare_digest(browser_nonce, pending["browser_nonce"])
    ):
        response = JSONResponse(
            {"detail": "OAuth state is invalid or expired. Please reconnect."},
            status_code=400,
        )
        response.delete_cookie(
            STATE_COOKIE, path="/", httponly=True,
            secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
            samesite="lax",
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    token_data = _post_form(LICHESS_TOKEN, {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": _client_id(),
        "redirect_uri": pending["callback"],
        "code_verifier": pending["verifier"],
    })
    token = token_data.get("access_token")
    if not isinstance(token, str) or not token:
        raise HTTPException(status_code=502, detail="Lichess did not return an access token.")

    session_id = secrets.token_urlsafe(32)
    with LOCK:
        _sessions[session_id] = {
            "token": token,
            "expires": time.time() + SESSION_TTL,
        }

    response = RedirectResponse("/?lichess=connected", status_code=303)
    _cookie(response, session_id)
    response.delete_cookie(
        STATE_COOKIE, path="/", httponly=True,
        secure=_setting("CHESSBOOK_COOKIE_SECURE").lower() == "true",
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.post("/disconnect")
def disconnect(request: Request):
    session = _read_session(request)
    if session:
        with LOCK:
            _sessions.pop(session[0], None)
    response = JSONResponse({"connected": False})
    _clear_cookie(response)
    return response


@router.get("/opening-explorer")
def opening_explorer(request: Request, variant: str = "standard",
                     moves: int = 8, play: str = ""):
    session = _read_session(request)
    if not session or not session[1].get("token"):
        raise HTTPException(status_code=401, detail="Connect your Lichess account to load opening statistics.")
    if variant != "standard":
        raise HTTPException(status_code=400, detail="Only standard chess is supported.")
    if not 1 <= moves <= 15:
        raise HTTPException(status_code=400, detail="Moves must be between 1 and 15.")
    uci_moves = [move for move in play.split(",") if move]
    if len(uci_moves) > 200 or any(
        len(move) not in (4, 5) or not move[:2].isalpha() or not move[2:4].isalnum()
        for move in uci_moves
    ):
        raise HTTPException(status_code=400, detail="Invalid move sequence.")
    query = urllib.parse.urlencode({
        "variant": variant, "moves": str(moves), "play": ",".join(uci_moves)
    })
    result = _get_json(LICHESS_EXPLORER + "?" + query, session[1]["token"])
    response = JSONResponse(result)
    response.headers["Cache-Control"] = "no-store"
    return response
