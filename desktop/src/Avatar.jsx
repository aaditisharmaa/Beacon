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

export default function Avatar() {
  const [state, setState] = useState(null);

  useEffect(() => window.beacon?.onAvatarState(setState), []);

  const petDrag = usePointerDrag(() => window.beacon?.avatarClicked());
  const bubbleDrag = usePointerDrag();

  const tone = state?.tone ?? "friendly";
  const message =
    state?.message ?? "Log in and I'll watch your deadlines 👀";

  return (
    <div className="avatar">
      <div
        className={`bubble bubble-${tone}`}
        style={{ cursor: "grab", touchAction: "none" }}
        title="Drag me"
        {...bubbleDrag}
      >
        {message}
      </div>

      <div
        title="Click: capture copied text. Drag: move me"
        style={{ cursor: "pointer", touchAction: "none" }}
        {...petDrag}
      >
        <Sprite anim={TONE_ANIM[tone] ?? "idle"} scale={4} />
      </div>
    </div>
  );
}