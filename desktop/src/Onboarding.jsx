import { useState } from "react";
import "./onboarding.css";
import { saveProfile, suggestSkills } from "./api";

const YEARS = [1, 2, 3, 4];

function toList(text) {
  return [
    ...new Set(
      text
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export default function Onboarding({
  token,
  profile,
  editing,
  onSaved,
  onCancel,
  onExpired,
}) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    branch: profile?.branch ?? "",
    year: profile?.year ?? 1,
    skills: (profile?.skills ?? []).join(", "),
    interests: (profile?.interests ?? []).join(", "),
    career_goal: profile?.career_goal ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const [proj, setProj] = useState({ link: "", text: "" });
  const [sugg, setSugg] = useState([]);
  const [sBusy, setSBusy] = useState(false);
  const [sErr, setSErr] = useState("");

  async function findSkills() {
    setSErr("");
    setSBusy(true);
    try {
      const r = await suggestSkills(token, proj.link.trim(), proj.text.trim());
      setSugg(r.skills);
      if (r.skills.length === 0) setSErr("No clear skills found, add more detail.");
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") onExpired();
      else if (err instanceof TypeError)
        setSErr("Cannot reach the server. Is Django running?");
      else setSErr(err.message);
    } finally {
      setSBusy(false);
    }
  }

  function addSkill(s) {
    const cur = toList(form.skills);
    if (!cur.includes(s)) setForm({ ...form, skills: [...cur, s].join(", ") });
    setSugg(sugg.filter((x) => x !== s));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const saved = await saveProfile(token, {
        full_name: form.full_name.trim(),
        branch: form.branch.trim(),
        year: Number(form.year),
        skills: toList(form.skills),
        interests: toList(form.interests),
        career_goal: form.career_goal.trim(),
        onboarded: true,
      });
      onSaved(saved);
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") onExpired();
      else if (err instanceof TypeError)
        setError("Cannot reach the server. Is Django running?");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const skillChips = toList(form.skills);
  const interestChips = toList(form.interests);

  const card = (
    <form className="ob-card" onSubmit={submit}>
      <h1>{editing ? "My profile" : "Welcome to BEACON"}</h1>
      <p className="muted">
        {editing
          ? "Update your details anytime."
          : "Tell me a bit about you, so I can plan tasks and find opportunities that fit."}
      </p>

      <label className="ob-field">
        <span>Name</span>
        <input
          value={form.full_name}
          onChange={set("full_name")}
          placeholder="Your name"
        />
      </label>

      <div className="ob-two">
        <label className="ob-field">
          <span>Branch</span>
          <input
            value={form.branch}
            onChange={set("branch")}
            placeholder="e.g. CSE (AI & ML)"
          />
        </label>
        <label className="ob-field">
          <span>Year</span>
          <select value={form.year} onChange={set("year")}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="ob-field">
        <span>Skills (comma separated)</span>
        <input
          value={form.skills}
          onChange={set("skills")}
          placeholder="python, react, machine learning"
        />
        {skillChips.length > 0 && (
          <div className="ob-chips">
            {skillChips.map((s) => (
              <span key={s} className="ob-chip">
                {s}
              </span>
            ))}
          </div>
        )}
      </label>

      <div className="ob-field">
        <span>Add skills from a project (optional)</span>
        <input
          value={proj.link}
          onChange={(e) => setProj({ ...proj, link: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Project or GitHub link"
        />
        <textarea
          rows={3}
          value={proj.text}
          onChange={(e) => setProj({ ...proj, text: e.target.value })}
          placeholder="Describe the project in 2-3 lines"
        />
        <div className="actions">
          <button
            type="button"
            className="ghost"
            onClick={findSkills}
            disabled={sBusy || !proj.text.trim()}
          >
            {sBusy ? "Thinking..." : "Suggest skills"}
          </button>
        </div>
        {sErr && <p className="error">{sErr}</p>}
        {sugg.length > 0 && (
          <div className="ob-chips">
            {sugg.map((s) => (
              <button
                type="button"
                key={s}
                className="ob-chip"
                onClick={() => addSkill(s)}
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="ob-field">
        <span>Interests (comma separated)</span>
        <input
          value={form.interests}
          onChange={set("interests")}
          placeholder="hackathons, astronomy, cybersecurity"
        />
        {interestChips.length > 0 && (
          <div className="ob-chips">
            {interestChips.map((s) => (
              <span key={s} className="ob-chip">
                {s}
              </span>
            ))}
          </div>
        )}
      </label>

      <label className="ob-field">
        <span>Career goal</span>
        <input
          value={form.career_goal}
          onChange={set("career_goal")}
          placeholder="e.g. ML engineer, research"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : editing ? "Save changes" : "Get started"}
        </button>
        {editing && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return editing ? <div className="ob-page">{card}</div> : <div className="ob-full">{card}</div>;
}