import { useEffect, useState } from "react";
import Sprite from "./Sprite";
import { TONE_ANIM } from "./spriteConfig";

export default function Avatar() {
  const [state, setState] = useState(null);

  useEffect(() => window.beacon?.onAvatarState(setState), []);

  const tone = state?.tone ?? "friendly";
  const message =
    state?.message ?? "Log in and I'll watch your deadlines 👀";

  return (
    <div className="avatar" style={{ WebkitAppRegion: "drag" }}>
      <div className={`bubble bubble-${tone}`}>{message}</div>
      <Sprite anim={TONE_ANIM[tone] ?? "idle"} scale={4} />
    </div>
  );
}