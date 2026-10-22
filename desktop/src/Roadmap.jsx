import { useEffect, useState } from "react";
import { getRoadmap } from "./api";

export default function Roadmap({ token, taskId, onExpired }) {
  const [roadmap, setRoadmap] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getRoadmap(token, taskId);
        if (!cancelled) setRoadmap(data);
      } catch (err) {
        if (cancelled) return;
        if (err.message === "SESSION_EXPIRED") onExpired();
        else if (err instanceof TypeError)
          setError("Cannot reach the server. Is Django running?");
        else setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) return <p className="muted">BEACON is planning...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!roadmap) return null;

  const survival = roadmap.plan_type === "survival";

  return (
    <div className="roadmap">
      {roadmap.replaced && survival && (
        <p className="banner">
          Deadline is close, so the old plan was scrapped. Here is a quick
          survival plan.
        </p>
      )}
      <span className={survival ? "badge badge-hot" : "badge"}>
        {survival ? "Survival plan" : "Full plan"}
      </span>
      <ol className="steps">
        {roadmap.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {roadmap.resources.length > 0 && (
        <div className="links">
          {roadmap.resources.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
              ▶ {r.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}