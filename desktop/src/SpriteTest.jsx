import { useState } from "react";
import sheet from "./assets/blob.png";
import Sprite from "./Sprite";
import { ANIMS, FRAME } from "./spriteConfig";

export default function SpriteTest() {
  const [size, setSize] = useState("loading...");
  return (
    <div style={{ padding: 16, color: "#e8e8ef", width: "100%" }}>
      <h3>
        Sheet size: {size} (frame = {FRAME}px)
      </h3>
      <img
        src={sheet}
        alt="sprite sheet"
        onLoad={(e) =>
          setSize(`${e.target.naturalWidth} x ${e.target.naturalHeight}`)
        }
        style={{ zoom: 3, imageRendering: "pixelated", background: "#333", display: "block" }}
      />
      <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
        {Object.keys(ANIMS).map((name) => (
          <div key={name} style={{ textAlign: "center" }}>
            <Sprite anim={name} scale={4} />
            <div>{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}