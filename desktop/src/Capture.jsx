import { useEffect, useState } from "react";
import { captureText, createTask } from "./api";
// ISO time ko <input type="datetime-local"> ke format mein badalta hai
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function Capture({ token, onSaved, onExpired, incoming  }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
    // avatar pe click se aaya clipboard text
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

  async function extract() {
    setError("");
    setBusy(true);
    try {
      const r = await captureText(token, text);
      setDraft({
        title: r.title,
        deadline: toLocalInput(r.deadline),
        complexity: r.complexity,
      });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

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
        placeholder="Paste a message or notice, BEACON will find the task..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={extract} disabled={busy || !text.trim()}>
        {busy ? "Reading..." : "Extract task"}
      </button>
    </div>
  );
}