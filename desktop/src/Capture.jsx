import { useEffect, useRef, useState } from "react";
import { captureText, createTask, transcribeAudio } from "./api";

// ISO time ko <input type="datetime-local"> ke format mein badalta hai
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const MAX_RECORD_MS = 60000;

function micErrorMessage(err) {
  if (err?.name === "NotAllowedError")
    return "Mic access is blocked. Check Windows Settings > Privacy > Microphone.";
  if (err?.name === "NotFoundError") return "No microphone found.";
  return "Could not start the microphone.";
}

export default function Capture({ token, onSaved, onExpired, incoming }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState("idle"); // idle | recording | transcribing

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const startingRef = useRef(false);

  // avatar pe click se aaya clipboard ya screenshot text
  useEffect(() => {
    if (!incoming?.text) return;
    setText(incoming.text);
    setDraft(null);
    setError("");
  }, [incoming]);

  function handleError(err) {
    if (err.message === "SESSION_EXPIRED") onExpired();
    else if (err instanceof TypeError)
      setError("Cannot reach the server. Is Django running?");
    else setError(err.message);
  }

  // override: voice se aaya text seedha bhejne ke liye
  async function extract(override) {
    const source = typeof override === "string" ? override : text;
    setError("");
    setBusy(true);
    try {
      const r = await captureText(tokenRef.current, source);
      setDraft({
        title: r.title,
        deadline: toLocalInput(r.deadline),
        complexity: r.complexity,
        planned_start: toLocalInput(new Date(Date.now() + 2 * 3600 * 1000).toISOString()),
      });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Voice ----------
  function releaseMic() {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function handleStopped(mimeType) {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    releaseMic();

    if (cancelledRef.current || chunks.length === 0) {
      setVoice("idle");
      return;
    }

    const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
    setVoice("transcribing");
    try {
      const r = await transcribeAudio(tokenRef.current, blob);
      const heard = (r.text || "").trim();
      if (!heard) {
        setError("Could not hear anything, try again closer to the mic.");
        return;
      }
      setText(heard);
      await extract(heard);
    } catch (err) {
      handleError(err);
    } finally {
      setVoice("idle");
    }
  }

  async function startRecording() {
    if (recorderRef.current || startingRef.current) return;
    startingRef.current = true;
    setError("");
    setDraft(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        handleStopped(rec.mimeType);
      };
      rec.start();

      recorderRef.current = rec;
      streamRef.current = stream;
      setVoice("recording");
      timerRef.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch (err) {
      setError(micErrorMessage(err));
    } finally {
      startingRef.current = false;
    }
  }

  function stopRecording() {
    clearTimeout(timerRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  }

  function cancelRecording() {
    cancelledRef.current = true;
    stopRecording();
  }

  // avatar menu ke "Speak" se recording shuru
  const startRef = useRef(null);
  startRef.current = startRecording;
  useEffect(() => window.beacon?.onVoiceStart(() => startRef.current?.()), []);

  // component hatne par mic band
  useEffect(
    () => () => {
      cancelledRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") rec.stop();
      releaseMic();
    },
    []
  );

  async function save() {
    if (!draft.title.trim() || !draft.deadline) {
      setError("Title and deadline are required");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await createTask(token, {
        title: draft.title.trim(),
        deadline: new Date(draft.deadline).toISOString(),
        complexity: Number(draft.complexity),
        planned_start: draft.planned_start ? new Date(draft.planned_start).toISOString() : null,
      });
      setText("");
      setDraft(null);
      await onSaved();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <div className="task">
        <strong>Confirm task</strong>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Title"
        />
        <input
          type="datetime-local"
          value={draft.deadline}
          onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
        />
        {!draft.deadline && (
          <p className="muted">No deadline found, please pick one.</p>
        )}
        <label className="muted">
          Complexity (1 easy, 5 hard):{" "}
          <input
            type="number"
            min="1"
            max="5"
            value={draft.complexity}
            onChange={(e) =>
              setDraft({ ...draft, complexity: e.target.value })
            }
          />
        </label>
        <label className="muted">
          When will you start?{" "}
          <input
            type="datetime-local"
            value={draft.planned_start || ""}
            onChange={(e) =>
              setDraft({ ...draft, planned_start: e.target.value })
            }
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
          <button className="ghost" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task">
      <textarea
        rows={3}
        placeholder="Paste a message or notice, or press Speak, BEACON will find the task..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {voice === "recording" && (
        <p className="muted">Listening... say your task, then press Stop.</p>
      )}
      {voice === "transcribing" && <p className="muted">Transcribing...</p>}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {voice === "recording" ? (
          <>
            <button onClick={stopRecording}>Stop and send</button>
            <button className="ghost" onClick={cancelRecording}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => extract()}
              disabled={busy || voice !== "idle" || !text.trim()}
            >
              {busy ? "Reading..." : "Extract task"}
            </button>
            <button
              className="ghost"
              onClick={startRecording}
              disabled={busy || voice !== "idle"}
            >
              Speak
            </button>
          </>
        )}
      </div>
    </div>
  );
}