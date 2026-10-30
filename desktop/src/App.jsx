import { useEffect, useState } from "react";
import FocusPanel from "./FocusPanel";
import Login from "./Login";
import Sprite from "./Sprite";
import TaskList from "./TaskList";
import Wall from "./Wall";
import { clearTokens, loadTokens, refreshAccess, saveTokens } from "./api";

export default function App() {
  const [tokens, setTokens] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("tasks");
  const [stats, setStats] = useState(null);
  const [incoming, setIncoming] = useState(null);

  function signIn(t) {
    saveTokens(t);
    setTokens(t);
  }

  function signOut() {
    clearTokens();
    setTokens(null);
    setView("tasks");
    setStats(null);
    setIncoming(null);
  }

  // saved refresh token se naya access token lo
  async function renew() {
    const saved = loadTokens();
    if (!saved?.refresh) return signOut();
    try {
      const { access } = await refreshAccess(saved.refresh);
      signIn({ ...saved, access });
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") signOut();
      else setTokens(null); // server band hai, saved login mat mitao
    }
  }

  useEffect(() => {
    (async () => {
      await renew();
      setChecking(false);
    })();
  }, []);

  // avatar pe click hua: Tasks screen kholo aur clipboard ka text Capture ko bhejo
  useEffect(
    () =>
      window.beacon?.onCaptureText((text) => {
        setView("tasks");
        setIncoming({ text, at: Date.now() });
      }),
    []
  );

  if (checking) return <p className="muted">Loading...</p>;
  if (!tokens) return <Login onLogin={signIn} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-logo">
          <Sprite anim="idle" scale={2} />
          <span>BEACON</span>
        </div>

        {stats && (
          <div className="stats">
            <div className="stat s-pink">
              <b>{stats.dueToday}</b>
              <span>Due today</span>
            </div>
            <div className="stat s-yellow">
              <b>{stats.next}</b>
              <span>Most urgent</span>
            </div>
            <div className="stat s-blue">
              <b>{stats.snoozes}</b>
              <span>Snoozes</span>
            </div>
            <div className="stat s-green">
              <b>{stats.doneWeek}</b>
              <span>Done this week</span>
            </div>
          </div>
        )}

        <nav>
          <p className="nav-label">General</p>
          <button
            className={"nav-item" + (view === "tasks" ? " active" : "")}
            onClick={() => setView("tasks")}
          >
            Tasks
          </button>
          <button
            className={"nav-item" + (view === "wall" ? " active" : "")}
            onClick={() => setView("wall")}
          >
            Wall <span className="count">{stats?.doneTotal ?? 0}</span>
          </button>
          <button className="nav-item" disabled>
            Roadmaps <span className="soon">soon</span>
          </button>
          <button className="nav-item" disabled>
            Schedule <span className="soon">soon</span>
          </button>
          <button className="nav-item" disabled>
            Analytics <span className="soon">soon</span>
          </button>
          <button className="nav-item" disabled>
            Opportunities <span className="soon">soon</span>
          </button>

          <p className="nav-label tools">Tools</p>
          <button
            className={"nav-item" + (view === "focus" ? " active" : "")}
            onClick={() => setView("focus")}
          >
            Focus mode
          </button>
          <button className="nav-item" disabled>
            Settings <span className="soon">soon</span>
          </button>
        </nav>

        <div className="side-bottom">
          <button className="profile-chip" disabled>
            <span className="chip-avatar">
              <Sprite anim="idle" scale={1} />
            </span>
            <span>My profile</span>
          </button>
          <button className="nav-item logout" onClick={signOut}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        {/* TaskList hamesha mounted rehta hai, taaki pet ka state na reset ho */}
        <div style={{ display: view === "tasks" ? "contents" : "none" }}>
          <TaskList
            key={tokens.access}
            token={tokens.access}
            onExpired={renew}
            onStats={setStats}
            incoming={incoming}
          />
        </div>
        {view === "wall" && (
          <Wall key={tokens.access} token={tokens.access} onExpired={renew} />
        )}
        {view === "focus" && <FocusPanel />}
      </main>
    </div>
  );
}