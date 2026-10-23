// Frame ka size (pixels). Blob 32x32 hai.
export const FRAME = 32;

// row = upar se kaunsi row (0 se), start = us row mein left se kaunsa frame (0 se),
// frames = kitne frames, fps = kitni tez chale
// Abhi maan rahe hain ki sheet ek hi lambi row hai: idle, walk, hurt, attack ek ke baad ek.
export const ANIMS = {
  idle: { row: 0, start: 0, frames: 2, fps: 3 },
  walk: { row: 1, start: 0, frames: 4, fps: 6 },
  hurt: { row: 2, start: 0, frames: 1, fps: 1 },
  attack: { row: 3, start: 0, frames: 3, fps: 6 },
};

// kaunsa tone kaunsi animation chalayega
export const TONE_ANIM = {
  friendly: "idle",
  nudging: "walk",
  strict: "attack",
};