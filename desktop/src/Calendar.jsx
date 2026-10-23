import { useState } from "react";

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Calendar({ tasks }) {
  const today = new Date();
  const [view, setView] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday se shuru
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const deadlines = tasks.map((t) => new Date(t.deadline));
  const hasDeadline = (day) => deadlines.some((d) => sameDay(d, day));

  const upcoming = [...tasks]
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  function shift(n) {
    setView(new Date(year, month + n, 1));
  }

  return (
    <>
      <div className="panel">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => shift(-1)}>
            ‹
          </button>
          <span className="cal-title">
            {view.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button className="cal-nav" onClick={() => shift(1)}>
            ›
          </button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <span key={d} className="cal-dow">
              {d}
            </span>
          ))}
          {cells.map((day, i) =>
            day ? (
              <span
                key={i}
                className={
                  "cal-day" +
                  (sameDay(day, today) ? " today" : "") +
                  (hasDeadline(day) ? " due" : "")
                }
              >
                {day.getDate()}
              </span>
            ) : (
              <span key={i} />
            )
          )}
        </div>
      </div>

      <div className="panel">
        <strong>Upcoming deadlines</strong>
        {upcoming.length === 0 && <p className="muted">Nothing due, you're free 😌</p>}
        {upcoming.map((t) => (
          <div className="tl-item" key={t.id}>
            <span className="tl-dot" />
            <div>
              <div className="tl-name">{t.title}</div>
              <div className="tl-time">
                {new Date(t.deadline).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}