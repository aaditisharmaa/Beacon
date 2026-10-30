const path = require("path");
const {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Notification,
  screen,
  shell,
} = require("electron");
const { createFocus, listRunningApps, startPowerShellWatcher } = require("./focus.cjs");

const APP_URL = "http://localhost:5173";
const TONES = ["friendly", "nudging", "strict"];
const AVATAR_W = 280;
const AVATAR_H = 240;

let mainWin = null;
let avatarWin = null;
let lastState = null; // task wali line (TaskList bhejta hai)
let avatarOverride = null; // Focus mode ki line, jab tak hai tab tak ye upar rehti hai

function isValidState(s) {
  return (
    s !== null &&
    typeof s === "object" &&
    TONES.includes(s.tone) &&
    typeof s.message === "string" &&
    s.message.length <= 200
  );
}

function sendStateToAvatar() {
  if (avatarWin && !avatarWin.isDestroyed()) {
    avatarWin.webContents.send("avatar:state", avatarOverride ?? lastState);
  }
}

// ---------- Focus mode ----------
const focus = createFocus({
  startWatcher: startPowerShellWatcher,
  onState: (state) => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("focus:state", state);
    }
  },
  onAvatar: (state) => {
    avatarOverride = isValidState(state) ? state : null;
    sendStateToAvatar();
  },
  onFinish: (summary) => {
    if (Notification.isSupported()) {
      new Notification({
        title: "Focus session complete",
        body:
          summary.violations === 0
            ? `${summary.minutes} minutes, not a single distraction!`
            : `${summary.minutes} minutes done, strayed ${summary.violations} time(s).`,
      }).show();
    }
  },
});

function fromMain(event) {
  return mainWin && !mainWin.isDestroyed() && event.sender === mainWin.webContents;
}

ipcMain.handle("focus:start", (event, opts) =>
  fromMain(event) ? focus.start(opts) : { ok: false, error: "Not allowed" }
);
ipcMain.handle("focus:stop", (event) => (fromMain(event) ? focus.stop() : null));
ipcMain.handle("focus:state", (event) => (fromMain(event) ? focus.getState() : null));
ipcMain.handle("focus:apps", (event) => (fromMain(event) ? listRunningApps() : []));

// ---------- Avatar ----------
// sirf main window se update lo, avatar window se nahi
ipcMain.on("avatar:update", (event, state) => {
  if (!fromMain(event)) return;
  lastState = isValidState(state) ? state : null;
  sendStateToAvatar();
});

// avatar ko pakad ke ghumana: window ko dx, dy se khiskao
ipcMain.on("avatar:move", (event, dx, dy) => {
  if (!avatarWin || avatarWin.isDestroyed()) return;
  if (event.sender !== avatarWin.webContents) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
  const [x, y] = avatarWin.getPosition();
  avatarWin.setPosition(Math.round(x + dx), Math.round(y + dy));
});

// avatar pe click: main window upar lao, aur clipboard ka text Capture box ko bhejo
// (clipboard sirf isi click par padha jata hai, background mein kabhi nahi)
ipcMain.on("avatar:click", async (event) => {
  if (!avatarWin || event.sender !== avatarWin.webContents) return;
  if (!mainWin || mainWin.isDestroyed()) return;

  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();

  // readText kisi Electron version mein Promise deta hai, kisi mein seedha string
  let raw = "";
  try {
    raw = await clipboard.readText();
  } catch {
    raw = "";
  }
  const text = typeof raw === "string" ? raw.trim().slice(0, 5000) : "";
  if (text && !mainWin.isDestroyed()) {
    mainWin.webContents.send("capture:text", text);
  }
});

function webPrefs() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, "preload.cjs"),
  };
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: webPrefs(),
  });

  // links app ke andar nahi, asli browser mein khulein (sirf https)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(APP_URL);
  return win;
}

function createAvatarWindow() {
  // screen ke neeche-right corner mein (taskbar ke upar)
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;

  const win = new BrowserWindow({
    width: AVATAR_W,
    height: AVATAR_H,
    x: x + width - AVATAR_W - 20,
    y: y + height - AVATAR_H - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: webPrefs(),
  });
  win.loadURL(`${APP_URL}/#/avatar`);
  if (process.env.AVATAR_DEBUG) win.webContents.openDevTools({ mode: "detach" });
  // avatar load hote hi jo state hai wo bhej do
  win.webContents.on("did-finish-load", sendStateToAvatar);
  return win;
}

function startApp() {
  mainWin = createMainWindow();
  avatarWin = createAvatarWindow();

  // main window band hone par avatar bhi band, aur focus watcher bhi
  mainWin.on("closed", () => {
    focus.stop();
    if (avatarWin && !avatarWin.isDestroyed()) avatarWin.close();
    mainWin = null;
    avatarWin = null;
    lastState = null;
    avatarOverride = null;
  });
}

app.whenReady().then(() => {
  startApp();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) startApp();
  });
});

// PowerShell watcher kabhi peeche chalta na reh jaye
app.on("before-quit", () => focus.stop());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
