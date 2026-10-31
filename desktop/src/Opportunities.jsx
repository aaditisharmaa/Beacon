import { useEffect, useState } from "react";
import { getOpportunities } from "./api";

const card = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(0,0,0,0.08)",
  marginBottom: 12,
};

const chip = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  marginRight: 6,
  marginTop: 6,
  border: "1px solid rgba(0,0,0,0.15)",
};

export default function Opportunities({ token, onExpired }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getOpportunities(token)
      .then((d) => {
        if (!cancelled) setItems(d);
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
  if (!items) return <p className="muted">Loading...</p>;

  return (
    <div className="tasks">
      <h1>Opportunities</h1>
      <p className="muted">
        Matched with your profile skills and interests. Events marked sample are demo data.
      </p>

      {items.length === 0 && (
        <p className="muted">No upcoming events right now.</p>
      )}

      {items.map((o) => (
        <div key={o.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <strong>{o.title}</strong>
            <span className="muted">{o.kind}{o.source === "sample" ? " (sample)" : ""}</span>
          </div>
          <p className="muted">
            Deadline: {new Date(o.deadline).toLocaleDateString()}
            {o.score > 0 ? ` | ${o.score} skill match` : " | no skill match yet"}
          </p>
          <div>
            {o.skill_tags.map((t) => (
              <span
                key={t}
                style={{
                  ...chip,
                  background: o.matched.includes(String(t).toLowerCase()) ? "#f4d35e" : "transparent",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          {o.url && (
            <p style={{ marginTop: 10 }}>
              <a href={o.url} target="_blank" rel="noreferrer">
                Open {o.source === "sample" ? "source site" : "event page"}
              </a>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}