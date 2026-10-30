// desktop/electron/screenshot.js
const { BrowserWindow, desktopCapturer, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ek time pe sirf ek capture session
let current = null; // { image, displaySize, win, resolve }

ipcMain.handle('shot:get-image', () => (current ? current.image.toDataURL() : null));
ipcMain.on('shot:done', (_e, rect) => finish(rect));
ipcMain.on('shot:cancel', () => finish(null));

function finish(rect) {
  if (!current) return;
  const { image, displaySize, win, resolve, timer } = current;
  current = null;
  clearTimeout(timer);
  globalShortcut.unregister('Escape');
  if (!win.isDestroyed()) win.close();

  // bahut chhota drag = cancel maan lo
  if (!rect || rect.w < 5 || rect.h < 5) return resolve(null);

  // CSS px -> real image px (DPI scaling yahin handle hoti hai)
  const ratio = image.getSize().width / displaySize.width;
  const cropped = image.crop({
    x: Math.round(rect.x * ratio),
    y: Math.round(rect.y * ratio),
    width: Math.max(1, Math.round(rect.w * ratio)),
    height: Math.max(1, Math.round(rect.h * ratio)),
  });
  resolve(cropped.toPNG());
}

/**
 * windowsToHide: avatar window, main app window (capture me na aaye)
 * return: PNG Buffer, ya null agar cancel hua
 */
async function captureRegion(windowsToHide = []) {
  if (current) return null;

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height } = display.size;
  const scale = display.scaleFactor;

  const hidden = windowsToHide.filter((w) => w && !w.isDestroyed() && w.isVisible());
  hidden.forEach((w) => w.hide());
  await sleep(200); // windows ko gayab hone ka time

  const restore = () => hidden.forEach((w) => !w.isDestroyed() && w.show());

  let image;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });
    const src = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    image = src.thumbnail;
  } catch (err) {
    restore();
    throw err;
  }

  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width,
    height,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'selector-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');

  const result = new Promise((resolve) => {
    current = { image, displaySize: { width, height }, win, resolve };
  });
  globalShortcut.register('Escape', () => finish(null));
  current.timer = setTimeout(() => finish(null), 30000); 

  // user ne window band kar di (Alt+F4 etc) to bhi cancel
  win.on('closed', () => finish(null));
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.loadFile(path.join(__dirname, 'selector.html'));

  const png = await result;
  restore();
  return png;
}

// OCR (local, free). npm i tesseract.js
async function ocr(pngBuffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(pngBuffer);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}

module.exports = { captureRegion, ocr };
