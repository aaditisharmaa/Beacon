import { useEffect, useState } from "react";
import { getAnalytics } from "./api";

const card = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(0,0,0,0.08)",
  minWidth: 120,
};

function Stat({ label, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

export default function Analytics({ token, onExpired }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAnalytics(token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.message === "SESSION_EXPIRED") onExpired();
        else if (err instanceof TypeError)
          setError("Cannot reach the server. Is Django running?");
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  const max = Math.max(1, ...data.daily.map((d) => d.done));

  return (
    <div className="tasks">
      <h1>Weekly summary</h1>
      <p className="muted">Last 7 days</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <Stat label="Completed" value={data.completed} />
        <Stat label="On time" value={data.on_time} />
        <Stat label="Late" value={data.late} />
        <Stat label="Overdue now" value={data.overdue} />
        <Stat label="Snoozes" value={data.snoozes} />
      </div>

      <div style={card}>
        <strong>Tasks done per day</strong>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 140, marginTop: 12 }}>
          {data.daily.map((d) => (
            <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
              <div
                title={`${d.done} done`}
                style={{
                  height: Math.max(4, (d.done / max) * 100),
                  background: "#f4d35e",
                  borderRadius: 6,
                }}
              />
              <div className="muted" style={{ fontSize: 12 }}>
                {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div style={{ fontSize: 12 }}>{d.done}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}