import { useEffect, useState } from "react";
import Calendar from "./Calendar";
import Capture from "./Capture";
import Roadmap from "./Roadmap";
import Sprite from "./Sprite";
import { completeTask, getCompleted, getNudge, getTasks, snoozeTask } from "./api";
import { computeAvatarState, dueText, taskTone } from "./avatarState";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday se
  return d;
}

// sidebar ke stat tiles ke liye numbers
function computeStats(pending, done) {
  const today = new Date().toDateString();
  const weekStart = startOfWeek();
  return {
    dueToday: pending.filter(
      (t) => new Date(t.deadline).toDateString() === today
    ).length,
    next: pending.length ? dueText(pending[0]).replace("due in ", "") : "None",
    snoozes: [...pending, ...done].reduce((s, t) => s + t.snooze_count, 0),
    doneWeek: done.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= weekStart
    ).length,
    doneTotal: done.length,
  };
}

function TaskCard({ task, token, run, openId, setOpenId, onExpired, front }) {
  return (
    <div className={`task toned tone-${taskTone(task)}${front ? " front" : ""}`}>
      <div className="task-top">
        <strong>{task.title}</strong>
        <span className="score">{task.priority_score}</span>
      </div>
      <p className="muted">{task.priority_reason}</p>
      <p className="muted">Due: {new Date(task.deadline).toLocaleString()}</p>
      <div className="actions">
        <button
          className="ghost"
          onClick={() => setOpenId(openId === task.id ? null : task.id)}
        >
          {openId === task.id ? "Hide roadmap" : "Roadmap"}
        </button>
        <button onClick={() => run(() => snoozeTask(token, task.id))}>
          Snooze
        </button>
        <button onClick={() => run(() => completeTask(token, task.id))}>
          Done
        </button>
      </div>
      {openId === task.id && (
        <Roadmap token={token} taskId={task.id} onExpired={onExpired} />
      )}
    </div>
  );
}

export default function TaskList({ token, onExpired, onStats, incoming }) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  async function run(action) {
    try {
      setError("");
      await action();
      const [pending, done] = await Promise.all([
        getTasks(token),
        getCompleted(token).catch(() => []),
      ]);
      setTasks(pending);
      onStats?.(computeStats(pending, done));
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") onExpired();
      else if (err instanceof TypeError)
        setError("Cannot reach the server. Is Django running?");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // screen pehli baar khulte hi tasks lao
  useEffect(() => {
    run(() => Promise.resolve());
  }, []);

  // tasks badle toh avatar ko naya tone/message bhejo
  useEffect(() => {
    if (loading) return;
    window.beacon?.sendAvatarState(computeAvatarState(tasks));
  }, [tasks, loading]);

  // AI ki Hinglish line aane par avatar ki template line badal do
  useEffect(() => {
    if (loading || !tasks[0]) return undefined;
    const top = tasks[0];
    const base = computeAvatarState(tasks);
    let cancelled = false;
    getNudge(token, top.id, base.tone)
      .then((r) => {
        if (!cancelled && r?.message) {
          window.beacon?.sendAvatarState({ tone: base.tone, message: r.message });
        }
      })
      .catch(() => {
        // AI na chale toh template wali line rehne do
      });
    return () => {
      cancelled = true;
    };
  }, [tasks, loading]);

  // logout par avatar ko reset karo
  useEffect(() => () => window.beacon?.sendAvatarState(null), []);

  const focused = tasks.find((t) => t.id === focusId) ?? tasks[0];
  const others = tasks.filter((t) => t !== focused);
  const shared = { token, run, openId, setOpenId, onExpired };

  return (
    <>
      <div className="tasks">
        <div className="hero hero-row">
          <Sprite anim="idle" scale={3} />
          <div>
            <h1>{greeting()}</h1>
            <p className="muted">
              {loading ? "" : `${tasks.length} pending task(s)`}
            </p>
          </div>
        </div>

        <Capture
          token={token}
          onSaved={() => run(() => Promise.resolve())}
          onExpired={onExpired}
          incoming={incoming}
        />

        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Loading...</p>}
        {!loading && !error && tasks.length === 0 && (
          <div className="empty">
            <Sprite anim="idle" scale={3} />
            <p className="muted">No pending tasks. Check your wall 🎉</p>
          </div>
        )}

        {tasks.length > 1 && (
          <div className="stack-bar">
            <span className="muted">
              {expanded ? "All tasks" : "Top priority on top"}
            </span>
            <div className="actions">
              {!expanded && focused !== tasks[0] && (
                <button className="ghost small" onClick={() => setFocusId(null)}>
                  Back to top
                </button>
              )}
              <button
                className="ghost small"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? "Collapse" : `Show all ${tasks.length}`}
              </button>
            </div>
          </div>
        )}

        {tasks.length > 0 &&
          (expanded ? (
            <div className="list">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} {...shared} />
              ))}
            </div>
          ) : (
            <div className="deck">
              <TaskCard task={focused} {...shared} front />
              {others.length > 0 && (
                <div className="peeks">
                  {others.slice(0, 3).map((t, i) => (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      className={`peek tone-${taskTone(t)}`}
                      style={{ "--i": i }}
                      onClick={() => setFocusId(t.id)}
                      onKeyDown={(e) => e.key === "Enter" && setFocusId(t.id)}
                    >
                      <span className="peek-title">{t.title}</span>
                      <span className="peek-meta">{dueText(t)}</span>
                    </div>
                  ))}
                </div>
              )}
              {others.length > 3 && (
                <p className="muted more">+{others.length - 3} more in the stack</p>
              )}
            </div>
          ))}
      </div>

      <aside className="right">
        <Calendar tasks={tasks} />
      </aside>
    </>
  );
}