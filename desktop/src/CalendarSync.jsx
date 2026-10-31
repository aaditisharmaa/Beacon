import { useEffect, useState } from "react";
import { createTask, disconnectCalendar, getCalendarEvents, getCalendarStatus, getTasks } from "./api";

const card = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(0,0,0,0.08)",
  marginBottom: 12,
};

const keyOf = (title, iso) => `${title.trim().toLowerCase()}|${new Date(iso).getTime()}`;

export default function CalendarSync({ token, onExpired }) {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [existing, setExisting] = useState(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function fail(err) {
    if (err.message === "SESSION_EXPIRED") onExpired();
    else if (err instanceof TypeError) setError("Cannot reach the server. Is Django running?");
    else setError(err.message);
  }

  async function load() {
    setError("");
    setBusy(true);
    try {
      const st = await getCalendarStatus(token);
      setStatus(st);
      if (st.connected) {
        const [ev, tasks] = await Promise.all([getCalendarEvents(token), getTasks(token)]);
        setEvents(ev);
        setExisting(new Set(tasks.map((t) => keyOf(t.title, t.deadline))));
      } else {
        setEvents([]);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function add(ev) {
    setError("");
    try {
      await createTask(token, {
        title: ev.title,
        deadline: new Date(ev.start).toISOString(),
        complexity: 2,
      });
      setExisting(new Set([...existing, keyOf(ev.title, ev.start)]));
    } catch (err) {
      fail(err);
    }
  }

  async function disconnect() {
    try {
      await disconnectCalendar(token);
      await load();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="tasks">
      <h1>Google Calendar</h1>
      <p className="muted">
        BEACON only reads your upcoming events (next 14 days). Nothing is added to your tasks until you tap Add.
      </p>

      {error && <p className="error">{error}</p>}
      {!status && !error && <p className="muted">Loading...</p>}

      {status && !status.configured && (
        <div style={card}>
          <p className="muted">
            Google keys are not set on the server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
            to backend/.env and restart Django.
          </p>
        </div>
      )}

      {status && status.configured && !status.connected && (
        <div style={card}>
          <p>Connect your Google account to see your events here.</p>
          <div className="actions">
            <a href={status.url} target="_blank" rel="noreferrer">
              <button type="button">Connect Google Calendar</button>
            </a>
            <button type="button" className="ghost" onClick={load} disabled={busy}>
              I connected, refresh
            </button>
          </div>
        </div>
      )}

      {status && status.connected && (
        <>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button type="button" className="ghost" onClick={load} disabled={busy}>
              {busy ? "Loading..." : "Refresh"}
            </button>
            <button type="button" className="ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {events.length === 0 && !busy && <p className="muted">No upcoming events in the next 14 days.</p>}
          {events.map((ev) => {
            const added = existing.has(keyOf(ev.title, ev.start));
            return (
              <div key={ev.id + ev.start} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{ev.title}</strong>
                  <button type="button" className="ghost" disabled={added} onClick={() => add(ev)}>
                    {added ? "Added" : "Add as task"}
                  </button>
                </div>
                <p className="muted">{new Date(ev.start).toLocaleString()}</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}