import { useEffect, useState } from "react";
import "./focus.css";

const DURATIONS = [1, 15, 25, 45, 60];
const STORAGE_KEY = "beacon_focus_apps";
const MAX_MINUTES = 720;

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveApps(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // app still works if storage fails
  }
}

function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function FocusPanel() {
  const api = window.beacon;
  const supported = Boolean(api?.focusStart);

  const [state, setState] = useState({ active: false });
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState(loadSaved);
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [now, setNow] = useState(Date.now());

  async function refreshApps() {
    setLoadingApps(true);
    try {
      setApps(await api.focusApps());
    } catch {
      setApps([]);
    } finally {
      setLoadingApps(false);
    }
  }

  useEffect(() => {
    if (!supported) return undefined;
    api.focusGetState().then((s) => s && setState(s)).catch(() => {});
    refreshApps();
    return api.onFocusState(setState);
  }, []);

  // tick every second for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggle(name) {
    setSelected((prev) => {
      const next = prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name];
      saveApps(next);
      return next;
    });
  }

  function pickPreset(d) {
    setMinutes(d);
    setCustom("");
  }

  function onCustomChange(e) {
    const raw = e.target.value;
    if (raw === "") {
      setCustom("");
      setMinutes(25);
      return;
    }
    const v = Math.min(MAX_MINUTES, Math.max(1, Math.floor(Number(raw) || 1)));
    setCustom(String(v));
    setMinutes(v);
  }

  async function start() {
    setError("");
    try {
      const res = await api.focusStart({ minutes, allowed: selected });
      if (!res?.ok) setError(res?.error || "Could not start focus mode");
      else if (res.state) setState(res.state);
    } catch (err) {
      setError(err.message);
    }
  }

  async function stop() {
    try {
      const s = await api.focusStop();
      if (s) setState(s);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!supported) {
    return (
      <div className="fm-page">
        <div className="hero">
          <h1>Focus mode</h1>
          <p className="muted">This only works inside the BEACON desktop app.</p>
        </div>
      </div>
    );
  }

  const shownApps = [...new Set([...apps, ...selected])].sort();

  return (
    <div className="fm-page">
      <div className="hero">
        <h1>Focus mode</h1>
        <p className="muted">
          Start a session, and as soon as you open any other app, your pet will
          call you back.
        </p>
      </div>

      {state.active ? (
        <div className="fm-card fm-active">
          <p className="fm-label">Time left</p>
          <p className="fm-clock">{mmss(state.endsAt - now)}</p>
          <p className="muted">
            {state.minutes} min session | strayed {state.violations}{" "}
            {state.violations === 1 ? "time" : "times"}
          </p>
          <p className="muted">
            Allowed: {state.allowed.join(", ")} (BEACON is always allowed)
          </p>
          <button onClick={stop}>End session</button>
        </div>
      ) : (
        <div className="fm-card">
          {state.summary && (
            <p className="fm-summary">
              {state.summary.completed
                ? `Last session completed: ${state.summary.minutes} min, strayed ${state.summary.violations} ${
                    state.summary.violations === 1 ? "time" : "times"
                  }.`
                : "Last session was stopped midway."}
            </p>
          )}
          {state.error && <p className="error">{state.error}</p>}

          <p className="fm-label">How long?</p>
          <div className="fm-row">
            {DURATIONS.map((d) => (
              <button
                key={d}
                className={"fm-chip" + (minutes === d && !custom ? " on" : "")}
                onClick={() => pickPreset(d)}
              >
                {d === 1 ? "1 min (test)" : `${d} min`}
              </button>
            ))}
            <input
              className={"fm-custom" + (custom ? " on" : "")}
              type="number"
              min="1"
              max={MAX_MINUTES}
              placeholder="Custom (min)"
              value={custom}
              onChange={onCustomChange}
            />
          </div>

          <div className="fm-row fm-between">
            <p className="fm-label">Which apps are allowed?</p>
            <button
              className="ghost small"
              onClick={refreshApps}
              disabled={loadingApps}
            >
              {loadingApps ? "Searching..." : "Refresh list"}
            </button>
          </div>
          <p className="muted">
            Tick only the apps you need for work (like VS Code or a browser).
            You'll get a warning if anything else opens.
          </p>

          <div className="fm-apps">
            {shownApps.length === 0 && (
              <p className="muted">
                No apps found. Open the apps you work in and hit Refresh.
              </p>
            )}
            {shownApps.map((name) => (
              <label key={name} className="fm-app">
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => toggle(name)}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>

          {error && <p className="error">{error}</p>}
          <button onClick={start} disabled={selected.length === 0}>
            Start focus session
          </button>
          <p className="muted fm-privacy">
            Privacy: only the app name is checked, on your computer, in memory.
            Window titles are never read, saved or sent.
          </p>
        </div>
      )}
    </div>
  );
}