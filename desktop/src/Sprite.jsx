import { useEffect, useState } from "react";
import sheet from "./assets/blob.png";
import { ANIMS, FRAME } from "./spriteConfig";

export default function Sprite({ anim = "idle", scale = 4 }) {
  const a = ANIMS[anim] ?? ANIMS.idle;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (a.frames <= 1) return undefined;
    const id = setInterval(
      () => setFrame((f) => (f + 1) % a.frames),
      1000 / a.fps
    );
    return () => clearInterval(id);
  }, [a.frames, a.fps, a.start, a.row]);

  const shown = frame % Math.max(1, a.frames);
  const box = FRAME * scale;

  return (
    <div style={{ width: box, height: box }}>
      <div
        style={{
          width: FRAME,
          height: FRAME,
          backgroundImage: `url(${sheet})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: `${-(a.start + shown) * FRAME}px ${-a.row * FRAME}px`,
          imageRendering: "pixelated",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}