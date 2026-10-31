from pathlib import Path
import re

api_path = Path("src/opening-explorer-api.ts")
app_path = Path("src/App.tsx")
vite_path = Path("vite.config.ts")

api = api_path.read_text(encoding="utf-8-sig")
app = app_path.read_text(encoding="utf-8-sig")
vite = vite_path.read_text(encoding="utf-8-sig")

# Route all opening statistics through the backend, never directly to Lichess.
old_url = '`https://explorer.lichess.ovh/lichess?${query.toString()}`'
if old_url not in api:
    raise SystemExit("Expected direct Lichess API URL not found; no changes written.")
api = api.replace(old_url, '`/api/lichess/opening-explorer?${query.toString()}`', 1)
api = api.replace(
    '      method: "GET",\n      headers: { Accept: "application/json" },',
    '      method: "GET",\n      credentials: "same-origin",\n      headers: { Accept: "application/json" },',
    1,
)

api += '''

export type LichessConnectionStatus = {
  connected: boolean;
  configured: boolean;
};

export async function getLichessConnectionStatus(
  signal?: AbortSignal,
): Promise<LichessConnectionStatus> {
  const response = await fetch("/api/lichess/status", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Connection status request failed (${response.status}).`);
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") {
    throw new Error("Invalid connection status response.");
  }
  const status = value as Record<string, unknown>;
  return {
    connected: status.connected === true,
    configured: status.configured === true,
  };
}

export async function disconnectLichess(): Promise<void> {
  const response = await fetch("/api/lichess/disconnect", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Disconnect request failed (${response.status}).`);
  }
}
'''

import_anchor = 'import { fetchOpeningExplorerStats, type OpeningExplorerStats } from "./opening-explorer-api";'
if import_anchor not in app:
    raise SystemExit("Opening Explorer API import not found.")
app = app.replace(
    import_anchor,
    'import { fetchOpeningExplorerStats, getLichessConnectionStatus, disconnectLichess, type OpeningExplorerStats, type LichessConnectionStatus } from "./opening-explorer-api";',
    1,
)

state_anchor = '  const [openingStatsStatus, setOpeningStatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");'
if state_anchor not in app:
    raise SystemExit("Opening statistics state declaration not found.")
app = app.replace(
    state_anchor,
    state_anchor + '''
  const [lichessStatus, setLichessStatus] = useState<LichessConnectionStatus | null>(null);
  const [lichessStatusError, setLichessStatusError] = useState("");
  const [lichessActionBusy, setLichessActionBusy] = useState(false);
''',
    1,
)

# Add one status refresh effect after the state declarations.
effect_anchor = state_anchor + '''
  const [lichessStatus, setLichessStatus] = useState<LichessConnectionStatus | null>(null);
  const [lichessStatusError, setLichessStatusError] = useState("");
  const [lichessActionBusy, setLichessActionBusy] = useState(false);
'''
status_effect = '''
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("lichess");
    if (result === "connected" || result === "denied") {
      params.delete("lichess");
      const rest = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash,
      );
      if (result === "denied") setLichessStatusError("Lichess authorization was cancelled.");
    }
    void getLichessConnectionStatus(controller.signal)
      .then((status) => {
        setLichessStatus(status);
        setLichessStatusError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLichessStatus(null);
          setLichessStatusError("Could not check Lichess connection. Ensure the backend is running.");
        }
      });
    return () => controller.abort();
  }, []);
'''
if 'getLichessConnectionStatus(controller.signal)' not in app:
    if effect_anchor not in app:
        raise SystemExit("Could not locate safe hook insertion point.")
    app = app.replace(effect_anchor, effect_anchor + status_effect, 1)

# Do not request statistics until the user has connected.
fetch_effect_start = app.find('  useEffect(() => {\n    if (workspaceMode !== "opening-explorer") return;')
if fetch_effect_start < 0:
    raise SystemExit("Opening statistics effect not found.")
fetch_effect_end = app.find('\n  }, [', fetch_effect_start)
if fetch_effect_end < 0:
    raise SystemExit("Opening statistics effect dependency list not found.")
effect_text = app[fetch_effect_start:fetch_effect_end]
effect_text_new = effect_text.replace(
    '    if (workspaceMode !== "opening-explorer") return;',
    '''    if (workspaceMode !== "opening-explorer") return;
    if (!lichessStatus?.connected) {
      setOpeningStats(null);
      setOpeningStatsStatus("idle");
      return;
    }''',
    1,
)
if effect_text_new == effect_text:
    raise SystemExit("Could not add connected-session guard to statistics effect.")
app = app[:fetch_effect_start] + effect_text_new + app[fetch_effect_end:]

# Add the connection status to that effect's dependency list.
dep_match = re.search(
    r'(  useEffect\(\(\) => \{\n    if \(workspaceMode !== "opening-explorer"\) return;.*?\n  \}, \[)([^\]]*)(\]\);)',
    app, flags=re.S
)
if not dep_match:
    raise SystemExit("Could not find statistics effect dependencies.")
deps = dep_match.group(2)
if "lichessStatus?.connected" not in deps:
    deps = deps.rstrip() + ", lichessStatus?.connected"
    app = app[:dep_match.start(2)] + deps + app[dep_match.end(2):]

# Insert visible controls directly below the existing panel title.
ui_anchor = '              <h3>Opening Explorer</h3>'
ui = '''              <h3>Opening Explorer</h3>
              <div className="lichess-connection-controls">
                {lichessStatus?.connected ? (
                  <>
                    <span role="status">Lichess connected</span>
                    <button
                      type="button"
                      disabled={lichessActionBusy}
                      onClick={() => {
                        setLichessActionBusy(true);
                        void disconnectLichess()
                          .then(() => {
                            setLichessStatus((current) => current ? { ...current, connected: false } : current);
                            setOpeningStats(null);
                            setOpeningStatsStatus("idle");
                            setNotice("Lichess disconnected.");
                          })
                          .catch(() => setLichessStatusError("Could not disconnect. Check that the backend is running."))
                          .finally(() => setLichessActionBusy(false));
                      }}
                    >{lichessActionBusy ? "Disconnecting…" : "Disconnect"}</button>
                  </>
                ) : (
                  <>
                    <span>{lichessStatus?.configured === false
                      ? "Lichess OAuth needs configuration."
                      : "Connect Lichess to load opening statistics."}</span>
                    <button
                      type="button"
                      className="green-button"
                      disabled={lichessActionBusy || lichessStatus?.configured === false}
                      onClick={() => { window.location.assign("/api/lichess/connect"); }}
                    >Connect Lichess</button>
                  </>
                )}
              </div>
              {lichessStatusError && <p role="status">{lichessStatusError}</p>}'''
if ui_anchor not in app:
    raise SystemExit("Opening Explorer title insertion point not found.")
app = app.replace(ui_anchor, ui, 1)

api_path.write_text(api, encoding="utf-8")
app_path.write_text(app, encoding="utf-8")
print("Frontend OAuth integration written.")
