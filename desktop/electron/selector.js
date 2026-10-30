// desktop/electron/selector.js
const bg = document.getElementById('bg');
const dim = document.getElementById('dim');
const box = document.getElementById('box');
const hint = document.getElementById('hint');

let start = null;

window.shot.getImage().then((url) => {
  if (url) bg.src = url;
});

function rectFrom(e) {
  const x = Math.min(start.x, e.clientX);
  const y = Math.min(start.y, e.clientY);
  const w = Math.abs(e.clientX - start.x);
  const h = Math.abs(e.clientY - start.y);
  return { x, y, w, h };
}

function draw(e) {
  const r = rectFrom(e);
  box.style.left = r.x + 'px';
  box.style.top = r.y + 'px';
  box.style.width = r.w + 'px';
  box.style.height = r.h + 'px';
}

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  start = { x: e.clientX, y: e.clientY };
  dim.style.display = 'none'; // ab box ka shadow dim karega
  hint.style.display = 'none';
  box.style.display = 'block';
  draw(e);
});

window.addEventListener('mousemove', (e) => {
  if (start) draw(e);
});

window.addEventListener('mouseup', (e) => {
  if (!start) return;
  const r = rectFrom(e);
  start = null;
  window.shot.done(r);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.shot.cancel();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.shot.cancel();
});