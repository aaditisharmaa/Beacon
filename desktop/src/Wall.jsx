import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./wall.css";

const BASE_URL = "http://127.0.0.1:8001";
const COLORS = [
  "#d9f79a", "#f5a3a3", "#f5a3c7", "#fde38a",
  "#a9c0f2", "#9be0d3", "#fbb872", "#cbb8ec",
];
const NOTE = 132; // note ka size (px)
const DAYS = 30; // sirf last 30 din
const MAX_NOTES = 250; // isse zyada ho toh sirf sabse naye
// pehle seedhe cells, phir beech ke gaps bharte hain
const OFFSETS = [[0, 0], [0.5, 0.5], [0.5, 0], [0, 0.5]];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// same seed pe hamesha same random numbers
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(n, seed) {
  const arr = Array.from({ length: n }, (_, i) => i);
  const r = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function layout(notes, width, height) {
  const cols = Math.max(1, Math.floor(width / NOTE));
  const rows = Math.max(1, Math.floor(height / NOTE));
  const cellW = width / cols;
  const cellH = height / rows;
  const perPass = cols * rows;
  const maxX = Math.max(0, width - NOTE);
  const maxY = Math.max(0, height - NOTE);
  const orders = {};

  return notes.map((note, i) => {
    const pass = Math.floor(i / perPass);
    const r = rng(hash(String(note.id)));
    let x;
    let y;

    if (pass < OFFSETS.length) {
      if (!orders[pass]) orders[pass] = shuffled(perPass, pass * 9973 + perPass);
      const cell = orders[pass][i % perPass];
      const [ox, oy] = OFFSETS[pass];
      x = ((cell % cols) + ox) * cellW + (cellW - NOTE) / 2 + (r() - 0.5) * 16;
      y = (Math.floor(cell / cols) + oy) * cellH + (cellH - NOTE) / 2 + (r() - 0.5) * 16;
    } else {
      x = r() * maxX;
      y = r() * maxY;
    }

    return {
      note,
      x: Math.min(maxX, Math.max(0, x)),
      y: Math.min(maxY, Math.max(0, y)),
      rot: (r() - 0.5) * 12,
      z: i + 1,
    };
  });
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// token do toh ye khud done tasks laata hai, ya seedha notes array do
export default function Wall({ token, onExpired, notes }) {
  const boardRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [loaded, setLoaded] = useState([]);
  const [loading, setLoading] = useState(!notes);
  const [error, setError] = useState("");

  // done tasks backend se lao
  useEffect(() => {
    if (notes || !token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/tasks/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onExpired?.();
          return;
        }
        if (!res.ok) throw new Error("Could not load your wall");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results ?? [];
        if (!cancelled) setLoaded(list.filter((t) => t.status === "done"));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof TypeError
            ? "Cannot reach the server. Is Django running?"
            : err.message
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, notes]);

  // board ka available size napo, window resize hone par dobara
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const update = () => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const source = notes ?? loaded;

  const visible = useMemo(() => {
    const since = Date.now() - DAYS * 864e5;
    return source
      .filter((n) => n.completed_at && new Date(n.completed_at).getTime() >= since)
      .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
      .slice(-MAX_NOTES);
  }, [source]);

  const placed = useMemo(
    () => (width && height ? layout(visible, width, height) : []),
    [visible, width, height]
  );

  const isLate = (n) =>
    n.deadline && new Date(n.completed_at) > new Date(n.deadline);
  const onTime = visible.filter((n) => !isLate(n)).length;

  const message = error
    ? error
    : loading
    ? "Loading..."
    : visible.length === 0
    ? "Finish a task and it gets stuck here"
    : "";

  return (
    <div className="wall-page">
      <div className="hero">
        <h1>Wall</h1>
        <p className="muted">
          Last {DAYS} days | {visible.length} done | {onTime} on time
        </p>
      </div>

      {/* board hamesha render hota hai, warna uski chaudai napi nahi ja sakti */}
      <div className="sw-board" ref={boardRef}>
        {message && <p className="sw-empty">{message}</p>}
        {placed.map(({ note, x, y, rot, z }) => (
          <div
            key={note.id}
            className="sw-note"
            title={note.title}
            style={{
              left: x,
              top: y,
              width: NOTE,
              height: NOTE,
              background: COLORS[hash(String(note.id)) % COLORS.length],
              "--rot": `${rot}deg`,
              "--z": z,
            }}
          >
            <div className="sw-title">{note.title}</div>
            <div className="sw-meta">
              <span>{shortDate(note.completed_at)}</span>
              {isLate(note) && <span className="sw-tag">late</span>}
              {note.snooze_count > 0 && (
                <span className="sw-tag">snoozed x{note.snooze_count}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
