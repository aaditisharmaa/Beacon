import { useEffect, useState } from "react";
import { completeTask, getTasks, snoozeTask } from "./api";

export default function TaskList({ token, onExpired, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function run(action) {
    try {
      setError("");
      await action();
      setTasks(await getTasks(token));
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

  return (
    <div className="tasks">
      <div className="header">
        <h1>Your tasks</h1>
        <button className="ghost" onClick={onLogout}>
          Log out
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="muted">No pending tasks 🎉</p>
      )}

      {tasks.map((task) => (
        <div className="task" key={task.id}>
          <div className="task-top">
            <strong>{task.title}</strong>
            <span className="score">{task.priority_score}</span>
          </div>
          <p className="muted">{task.priority_reason}</p>
          <p className="muted">
            Due: {new Date(task.deadline).toLocaleString()}
          </p>
          <div className="actions">
            <button onClick={() => run(() => snoozeTask(token, task.id))}>
              Snooze
            </button>
            <button onClick={() => run(() => completeTask(token, task.id))}>
              Done
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}