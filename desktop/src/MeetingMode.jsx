import { useEffect, useRef, useState } from "react";
import { createTask, extractMeeting, transcribeAudio } from "./api";

const card = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(0,0,0,0.08)",
  marginBottom: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const SEGMENT_MS = 25000;

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function MeetingMode({ token, onExpired, onTasksChanged, initialTitle }) {
  const [title, setTitle] = useState(initialTitle || "");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("setup"); // setup | live | done
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [decisions, setDecisions] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [typed, setTyped] = useState({ title: "", deadline: "" });
  const [addedCount, setAddedCount] = useState(0);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const queueRef = useRef(Promise.resolve());
  const transcriptRef = useRef("");
  const segmentsRef = useRef(0);
  const titleRef = useRef("");
  titleRef.current = title;

  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);

  function fail(err) {
    if (err.message === "SESSION_EXPIRED") onExpired();
    else if (err instanceof TypeError) setError("Cannot reach the server. Is Django running?");
    else setError(err.message);
  }

  // ---------- AI: transcript se action items ----------
  async function extractNow() {
    const text = transcriptRef.current.trim();
    if (!text) return;
    try {
      const r = await extractMeeting(tokenRef.current, titleRef.current.trim(), text);
      setSummary(r.summary || "");
      setDecisions(r.decisions || []);
      setItems((old) => {
        const seen = new Set(old.map((o) => o.what.trim().toLowerCase()));
        const fresh = r.action_items
          .filter((it) => !seen.has(it.what.trim().toLowerCase()))
          .map((it) => ({
            what: it.what,
            owner: it.owner,
            deadline: toLocalInput(it.deadline),
            complexity: it.complexity,
            added: false,
          }));
        return [...old, ...fresh];
      });
    } catch (err) {
      fail(err);
    }
  }

  // ---------- Recording: har segment ek poori audio file ----------
  async function handleSegment(blob) {
    if (blob.size < 2000) return; // lagbhag khaamoshi
    setStatus("Transcribing...");
    try {
      const r = await transcribeAudio(tokenRef.current, blob);
      const heard = (r.text || "").trim();
      if (heard) {
        transcriptRef.current = (transcriptRef.current + " " + heard).trim();
        setTranscript(transcriptRef.current);
      }
      segmentsRef.current += 1;
      if (segmentsRef.current % 2 === 0) await extractNow();
      setError("");
    } catch (err) {
      fail(err);
    } finally {
      setStatus(runningRef.current ? "Listening..." : "");
    }
  }

  function startSegment() {
    const stream = streamRef.current;
    if (!stream || !runningRef.current) return;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      queueRef.current = queueRef.current.then(() => handleSegment(blob));
      if (runningRef.current) startSegment();
    };
    rec.start();
    recRef.current = rec;
    timerRef.current = setTimeout(() => {
      if (rec.state === "recording") rec.stop();
    }, SEGMENT_MS);
  }

  function releaseMic() {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setError("");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Mic access is blocked. Check Windows Settings > Privacy > Microphone."
          : "Could not start the microphone."
      );
      return;
    }
    transcriptRef.current = "";
    segmentsRef.current = 0;
    setTranscript("");
    setItems([]);
    setSummary("");
    setDecisions([]);
    setAddedCount(0);
    runningRef.current = true;
    setPhase("live");
    setStatus("Listening...");
    startSegment();
  }

  async function end() {
    runningRef.current = false;
    clearTimeout(timerRef.current);
    const rec = recRef.current;
    if (rec && rec.state === "recording") rec.stop();
    releaseMic();
    setPhase("done");
    setStatus("Finishing up...");
    await queueRef.current;
    await extractNow();
    setStatus("");
  }

  // component hatne par mic band
  useEffect(
    () => () => {
      runningRef.current = false;
      clearTimeout(timerRef.current);
      const rec = recRef.current;
      if (rec && rec.state === "recording") rec.stop();
      releaseMic();
    },
    []
  );

  // ---------- Tasks ----------
  const update = (i, patch) => setItems((old) => old.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  async function addItem(i) {
    const it = items[i];
    if (!it.what.trim() || !it.deadline) return setError("Item needs a name and a deadline.");
    setError("");
    try {
      await createTask(tokenRef.current, {
        title: it.what.trim(),
        deadline: new Date(it.deadline).toISOString(),
        complexity: Number(it.complexity) || 2,
      });
      update(i, { added: true });
      setAddedCount((n) => n + 1);
      onTasksChanged?.();
    } catch (err) {
      fail(err);
    }
  }

  async function addTyped() {
    if (!typed.title.trim() || !typed.deadline) return setError("Type a task and pick a deadline.");
    setError("");
    try {
      await createTask(tokenRef.current, {
        title: typed.title.trim(),
        deadline: new Date(typed.deadline).toISOString(),
        complexity: 2,
      });
      setTyped({ title: "", deadline: "" });
      setAddedCount((n) => n + 1);
      onTasksChanged?.();
    } catch (err) {
      fail(err);
    }
  }

  function reset() {
    setPhase("setup");
    setTranscript("");
    setItems([]);
    setSummary("");
    setDecisions([]);
    setError("");
  }

  return (
    <div className="tasks">
      <h1>Meeting mode</h1>
      <p className="muted">
        Start a session, BEACON listens and suggests action items. Nothing becomes a task until you tap Add.
      </p>

      {phase === "setup" && (
        <div style={card}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting name (e.g. Dr. Verma, project review)" />
          <label>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{" "}
            I have told everyone in the meeting that I am recording audio for notes. Audio is not saved, only text stays on screen.
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button onClick={start} disabled={!consent}>Start meeting</button>
          </div>
        </div>
      )}

      {phase !== "setup" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <strong>{title || "Untitled meeting"}</strong>
            {phase === "live" ? (
              <span style={{ color: "#c0392b", fontWeight: 700 }}>● REC {status && `· ${status}`}</span>
            ) : (
              <span className="muted">{status || "Meeting ended"}</span>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            {phase === "live" && <button onClick={end}>End meeting</button>}
            {phase === "live" && <button className="ghost" onClick={extractNow}>Check action items now</button>}
            {phase === "done" && <button className="ghost" onClick={reset}>New meeting</button>}
          </div>
          {addedCount > 0 && <p><strong>{addedCount} task(s) added.</strong></p>}
        </div>
      )}

      {phase !== "setup" && (
        <div style={card}>
          <strong>Add a task yourself</strong>
          <input value={typed.title} onChange={(e) => setTyped({ ...typed, title: e.target.value })} placeholder="Type a task..." />
          <input type="datetime-local" value={typed.deadline} onChange={(e) => setTyped({ ...typed, deadline: e.target.value })} />
          <div className="actions">
            <button onClick={addTyped}>Add task</button>
          </div>
        </div>
      )}

      {phase !== "setup" && (
        <div style={card}>
          <strong>Action items found</strong>
          {items.length === 0 && <p className="muted">Nothing yet. Items appear as the meeting goes on.</p>}
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: it.added ? 0.5 : 1 }}>
              <span className="muted">Owner: {it.owner}</span>
              <input value={it.what} disabled={it.added} onChange={(e) => update(i, { what: e.target.value })} />
              <input type="datetime-local" value={it.deadline} disabled={it.added} onChange={(e) => update(i, { deadline: e.target.value })} />
              {!it.deadline && !it.added && <p className="muted">No deadline mentioned, pick one.</p>}
              <div className="actions">
                <button className="ghost" disabled={it.added} onClick={() => addItem(i)}>
                  {it.added ? "Added" : "Add task"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {phase !== "setup" && (summary || decisions.length > 0) && (
        <div style={card}>
          <strong>Summary so far</strong>
          <p>{summary}</p>
          {decisions.length > 0 && (
            <ul>
              {decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {phase !== "setup" && (
        <div style={card}>
          <strong>Live transcript</strong>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{transcript || "Waiting for speech..."}</p>
        </div>
      )}
    </div>
  );
}