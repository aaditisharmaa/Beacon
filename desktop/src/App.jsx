import { useEffect, useState } from "react";
import Analytics from "./Analytics";
import CalendarSync from "./CalendarSync";
import MeetingMode from "./MeetingMode";
import FocusPanel from "./FocusPanel";
import Login from "./Login";
import Opportunities from "./Opportunities";
import Onboarding from "./Onboarding";
import Sprite from "./Sprite";
import TaskList from "./TaskList";
import Wall from "./Wall";
import {
  clearTokens,
  getProfile,
  getRecentEvents,
  loadTokens,
  refreshAccess,
  saveTokens,
} from "./api";

export default function App() {
  const [tokens, setTokens] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("tasks");
  const [stats, setStats] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [taskVersion, setTaskVersion] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [ended, setEnded] = useState(null);
  // undefined = load ho raha hai, null = load nahi hua (app phir bhi chalao)
  const [profile, setProfile] = useState(undefined);

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
    setProfile(undefined);
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

  // login ke baad profile lao (onboarding dikhani hai ya nahi)
  useEffect(() => {
    if (!tokens?.access) return undefined;
    let cancelled = false;
    getProfile(tokens.access)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.message === "SESSION_EXPIRED") renew();
        else setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tokens?.access]);

  // avatar pe click hua: Tasks screen kholo aur clipboard ka text Capture ko bhejo
  useEffect(
    () =>
      window.beacon?.onCaptureText((text) => {
        setView("tasks");
        setIncoming({ text, at: Date.now() });
      }),
    []
  );

  // calendar mein meeting abhi khatam hui? (sirf jab Google Calendar connected hai)
  useEffect(() => {
    if (!tokens?.access) return undefined;
    let stop = false;
    async function check() {
      try {
        const evs = await getRecentEvents(tokens.access);
        const now = Date.now();
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem("beacon_meeting_seen") || "[]"); } catch { seen = []; }
        const fresh = evs.find(
          (e) =>
            e.end && !e.all_day &&
            new Date(e.end).getTime() <= now &&
            now - new Date(e.end).getTime() < 30 * 60000 &&
            !seen.includes(e.id + e.end)
        );
        if (fresh && !stop) setEnded(fresh);
      } catch {
        // calendar connected nahi ya server band, chup raho
      }
    }
    check();
    const timer = setInterval(check, 120000);
    return () => { stop = true; clearInterval(timer); };
  }, [tokens?.access]);

  function markSeen(e) {
    try {
      const seen = JSON.parse(localStorage.getItem("beacon_meeting_seen") || "[]");
      localStorage.setItem("beacon_meeting_seen", JSON.stringify([...seen, e.id + e.end].slice(-50)));
    } catch {
      // ignore
    }
  }

  function openMeeting() {
    markSeen(ended);
    setMeetingTitle(ended.title);
    setEnded(null);
    setView("meeting");
  }

  function dismissMeeting() {
    markSeen(ended);
    setEnded(null);
  }
  function profileSaved(p) {
    setProfile(p);
    setView("tasks");
  }

  if (checking) return <p className="muted">Loading...</p>;
  if (!tokens) return <Login onLogin={signIn} />;
  if (profile === undefined) return <p className="muted">Loading...</p>;

  // pehli baar: onboarding poori screen pe
  if (profile && !profile.onboarded) {
    return (
      <Onboarding
        token={tokens.access}
        profile={profile}
        onSaved={profileSaved}
        onExpired={renew}
      />
    );
  }

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

          <button
            className={"nav-item" + (view === "analytics" ? " active" : "")}
            onClick={() => setView("analytics")}
          >
            Analytics
          </button>

          <button
            className={"nav-item" + (view === "opportunities" ? " active" : "")}
            onClick={() => setView("opportunities")}
          >
            Opportunities
          </button>

          <button
            className={"nav-item" + (view === "gcal" ? " active" : "")}
            onClick={() => setView("gcal")}
          >
            Google Calendar
          </button>
          <button
            className={"nav-item" + (view === "meeting" ? " active" : "")}
            onClick={() => setView("meeting")}
          >
            Meeting mode
          </button>
          <p className="nav-label tools">Tools</p>
          <button
            className={"nav-item" + (view === "focus" ? " active" : "")}
            onClick={() => setView("focus")}
          >
            Focus mode
          </button>
        </nav>

        <div className="side-bottom">
          <button
            className={"profile-chip" + (view === "profile" ? " active" : "")}
            onClick={() => setView("profile")}
          >
            <span className="chip-avatar">
              <Sprite anim="idle" scale={1} />
            </span>
            <span>{profile?.full_name || "My profile"}</span>
          </button>
          <button className="nav-item logout" onClick={signOut}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        {ended && view !== "meeting" && (
          <div
            className="task"
            style={{ position: "fixed", top: 12, right: 12, zIndex: 50, maxWidth: 320 }}
          >
            <strong>{ended.title}</strong> just ended. Kaam bata do?
            <div className="actions">
              <button onClick={openMeeting}>Add action items</button>
              <button className="ghost" onClick={dismissMeeting}>Dismiss</button>
            </div>
          </div>
        )}        {/* TaskList hamesha mounted rehta hai, taaki pet ka state na reset ho */}
        <div style={{ display: view === "tasks" ? "contents" : "none" }}>
          <TaskList
            key={tokens.access + taskVersion}
            token={tokens.access}
            onExpired={renew}
            onStats={setStats}
            incoming={incoming}
          />
        </div>
        {view === "wall" && (
          <Wall key={tokens.access} token={tokens.access} onExpired={renew} />
        )}
        {view === "analytics" && (
          <Analytics key={tokens.access} token={tokens.access} onExpired={renew} />
        )}
        {view === "opportunities" && (
          <Opportunities key={tokens.access} token={tokens.access} onExpired={renew} />
        )}
        {view === "gcal" && (
          <CalendarSync key={tokens.access} token={tokens.access} onExpired={renew} />
        )}        {view === "meeting" && (
          <MeetingMode
            initialTitle={meetingTitle}
            key={tokens.access + meetingTitle}
            token={tokens.access}
            onExpired={renew}
            onTasksChanged={() => setTaskVersion((v) => v + 1)}
          />
        )}        {view === "focus" && <FocusPanel />}
        {view === "profile" && profile && (
          <Onboarding
            token={tokens.access}
            profile={profile}
            editing
            onSaved={profileSaved}
            onCancel={() => setView("tasks")}
            onExpired={renew}
          />
        )}
      </main>
    </div>
  );
}