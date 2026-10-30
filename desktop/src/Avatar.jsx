import { useEffect, useRef, useState } from "react";
import Sprite from "./Sprite";
import { TONE_ANIM } from "./spriteConfig";

// pakad ke ghumao = window move, bina hile chhod do = click
function usePointerDrag(onClick) {
  const drag = useRef(null);

  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.screenX, y: e.screenY, moved: false };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.screenX - d.x;
      const dy = e.screenY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      d.moved = true;
      d.x = e.screenX;
      d.y = e.screenY;
      window.beacon?.moveAvatar(dx, dy);
    },
    onPointerUp: (e) => {
      const d = drag.current;
      drag.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (d && !d.moved) onClick?.();
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };
}

const menuBtn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid currentColor",
  background: "rgba(255,255,255,0.6)",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

export default function Avatar() {
  const [state, setState] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => window.beacon?.onAvatarState(setState), []);

  // menu 6 second baad apne aap band
  useEffect(() => {
    if (!menuOpen) return;
    const t = setTimeout(() => setMenuOpen(false), 6000);
    return () => clearTimeout(t);
  }, [menuOpen]);

  // pet pe click = menu khulo/band
  const petDrag = usePointerDrag(() => setMenuOpen((o) => !o));
  const bubbleDrag = usePointerDrag();

  const tone = state?.tone ?? "friendly";
  const message =
    state?.message ?? "Log in and I'll watch your deadlines 👀";

  function pickClipboard() {
    setMenuOpen(false);
    window.beacon?.avatarClicked();
  }

  function pickScreenshot() {
    setMenuOpen(false);
    window.beacon?.avatarScreenshot();
  }

  return (
    <div className="avatar">
      {menuOpen ? (
        // menu draggable bubble ke andar nahi hai, warna button clicks kho jayenge
        <div
          className={`bubble bubble-${tone}`}
          style={{ display: "flex", gap: 8, justifyContent: "center" }}
        >
          <button type="button" style={menuBtn} onClick={pickScreenshot}>
            Screenshot
          </button>
          <button type="button" style={menuBtn} onClick={pickClipboard}>
            Clipboard
          </button>
        </div>
      ) : (
        <div
          className={`bubble bubble-${tone}`}
          style={{ cursor: "grab", touchAction: "none" }}
          title="Drag me"
          {...bubbleDrag}
        >
          {message}
        </div>
      )}

      <div
        title="Click: menu. Drag: move me"
        style={{ cursor: "pointer", touchAction: "none" }}
        {...petDrag}
      >
        <Sprite anim={TONE_ANIM[tone] ?? "idle"} scale={4} />
      </div>
    </div>
  );
}