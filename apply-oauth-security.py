from pathlib import Path

main_path = Path("backend/app/main.py")
oauth_path = Path("backend/app/lichess_oauth.py")
vite_path = Path("vite.config.ts")

main = main_path.read_text(encoding="utf-8-sig")
oauth = oauth_path.read_text(encoding="utf-8-sig")
vite = vite_path.read_text(encoding="utf-8-sig")

# Load backend/.env before importing the OAuth module.
if "def load_backend_env()" not in main:
    anchor = "from __future__ import annotations"
    if anchor not in main:
        raise SystemExit("main.py future-import anchor not found")
    loader = '''
import os
from pathlib import Path

def load_backend_env() -> None:
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")

load_backend_env()
'''
    main = main.replace(anchor, anchor + "\n" + loader, 1)

# Bind the OAuth state to a short-lived, HTTP-only browser cookie.
if "STATE_COOKIE = " not in oauth:
    anchor = 'COOKIE_NAME = "chessbook_session"'
    if anchor not in oauth:
        raise SystemExit("OAuth cookie constant not found")
    oauth = oauth.replace(
        anchor, anchor + '\nSTATE_COOKIE = "chessbook_oauth_state"', 1
    )

connect_start = oauth.find('@router.get("/connect")')
callback_start = oauth.find('@router.get("/callback")')
if connect_start < 0 or callback_start < 0 or callback_start <= connect_start:
    raise SystemExit("OAuth connect/callback function boundaries not found")

connect_block = '''@router.get("/connect")
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


'''
callback_block = '''@router.get("/callback")
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


'''
oauth = oauth[:connect_start] + connect_block + callback_block + oauth[callback_start + (oauth[callback_start:].find("\n@router.") if "\n@router." in oauth[callback_start:] else len(oauth[callback_start:])):] if False else oauth

# Replace both functions using the next route decorator as the boundary.
import re
oauth2, n1 = re.subn(
    r'@router\.get\("/connect"\)\ndef connect\(request: Request\):.*?(?=\n@router\.)',
    connect_block.rstrip() + "\n\n", oauth, count=1, flags=re.S
)
if n1 != 1:
    raise SystemExit("Could not replace connect route safely")
oauth = oauth2
oauth2, n2 = re.subn(
    r'@router\.get\("/callback"\)\ndef callback\(request: Request, code: str = "", state: str = "", error: str = ""\):.*?(?=\n@router\.)',
    callback_block.rstrip() + "\n\n", oauth, count=1, flags=re.S
)
if n2 != 1:
    raise SystemExit("Could not replace callback route safely")
oauth = oauth2

# Same-origin dev proxy to the existing FastAPI service.
if '"/api":' not in vite:
    anchor = '    host: "127.0.0.1",'
    if anchor not in vite:
        raise SystemExit("Vite host configuration anchor not found")
    vite = vite.replace(
        anchor,
        anchor + '\n    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },',
        1,
    )

if "STATE_COOKIE" not in oauth or '"browser_nonce": browser_nonce' not in oauth:
    raise SystemExit("OAuth state-binding verification failed")
if "load_backend_env()" not in main or '"/api":' not in vite:
    raise SystemExit("Environment-loader or Vite-proxy verification failed")

main_path.write_text(main, encoding="utf-8")
oauth_path.write_text(oauth, encoding="utf-8")
vite_path.write_text(vite, encoding="utf-8")
print("Security changes written and source checks passed.")
