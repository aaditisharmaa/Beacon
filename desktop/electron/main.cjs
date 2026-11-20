const path = require("path");
const { captureRegion, ocr } = require("./screenshot.cjs");
const {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Notification,
  screen,
  session,
  shell,
} = require("electron");
const { createFocus, listRunningApps, startPowerShellWatcher } = require("./focus.cjs");
const { execFile } = require("child_process");

const APP_URL = app.isPackaged
  ? `file://${path.join(__dirname, "..", "dist", "index.html")}`
  : "http://localhost:5173";
const TONES = ["friendly", "nudging", "strict"];
const AVATAR_W = 280;
const AVATAR_H = 240;

let mainWin = null;
let avatarWin = null;
let lastState = null; // task wali line (TaskList bhejta hai)
let avatarOverride = null; // Focus mode ki line, jab tak hai tab tak ye upar rehti hai
let idleTimer = null;
let idleHoldTimer = null;
let lastIdleTier = "";

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

  function idleSeconds() {
    return new Promise((resolve) => {
      if (process.platform !== "win32") return resolve(0);
      const script = `
  Add-Type @'
  using System;
  using System.Runtime.InteropServices;
  public struct BeaconLastInput {
    [MarshalAs(UnmanagedType.U4)] public uint cbSize;
    [MarshalAs(UnmanagedType.U4)] public uint dwTime;
  }
  public static class BeaconIdle {
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref BeaconLastInput plii);
  }
  '@
  $li = New-Object BeaconLastInput
  $li.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($li)
  if ([BeaconIdle]::GetLastInputInfo([ref]$li)) {
    [Console]::Write(([Environment]::TickCount - $li.dwTime) / 1000)
  }
  `;
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        { windowsHide: true, timeout: 10000 },
        (err, stdout) => {
          const seconds = Number(String(stdout).trim());
          resolve(err || !Number.isFinite(seconds) ? 0 : seconds);
        }
      );
    });
  }

  function startIdleMonitoring() {
    if (idleTimer) return;
    idleTimer = setInterval(async () => {
      const seconds = await idleSeconds();
      let tier = "";
      if (seconds >= 20 * 60) tier = "strict";
      else if (seconds >= 10 * 60) tier = "nudging";
      else if (seconds >= 5 * 60) tier = "friendly";

      if (!tier) {
        lastIdleTier = "";
        if (avatarOverride?.source === "idle") {
          avatarOverride = null;
          sendStateToAvatar();
        }
        return;
      }

      if (tier === lastIdleTier) return;
      lastIdleTier = tier;
      clearTimeout(idleHoldTimer);
      const minutes = Math.floor(seconds / 60);
      const message =
        tier === "strict"
          ? `You've been away ${minutes} min. Come back and finish one small step.`
          : tier === "nudging"
            ? `Hey, ${minutes} min away. Your task is still waiting, but we can start easy.`
            : `A small break of ${minutes} min is okay. Ready when you are?`;
      avatarOverride = { tone: tier, message, source: "idle" };
      sendStateToAvatar();
    }, 15000);
  }

  function stopIdleMonitoring() {
    clearInterval(idleTimer);
    idleTimer = null;
    clearTimeout(idleHoldTimer);
    idleHoldTimer = null;
    lastIdleTier = "";
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

ipcMain.handle("shot:avatar", async (event) => {
  // sirf avatar window se allowed
  if (!avatarWin || avatarWin.isDestroyed() || event.sender !== avatarWin.webContents) {
    return { ok: false, error: "Not allowed" };
  }
  if (!mainWin || mainWin.isDestroyed()) return { ok: false };
  try {
    const png = await captureRegion([mainWin, avatarWin]);
    if (!png) return { ok: false, cancelled: true };
    const text = await ocr(png);

    // text Capture box mein bhejo aur main window upar lao
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
    if (text) mainWin.webContents.send("capture:text", text);
    return { ok: true, hasText: Boolean(text) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
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

// avatar menu se "Speak": main window upar lao, Capture ko recording shuru karne bolo
// (mic sirf isi click ke baad khulta hai)
ipcMain.on("avatar:speak", (event) => {
  if (!avatarWin || avatarWin.isDestroyed() || event.sender !== avatarWin.webContents) return;
  if (!mainWin || mainWin.isDestroyed()) return;

  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  mainWin.webContents.send("voice:start");
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

  if (app.isPackaged) win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  else win.loadURL(APP_URL);
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
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"), { hash: "/avatar" });
  } else {
    win.loadURL(`${APP_URL}/#/avatar`);
  }
  if (process.env.AVATAR_DEBUG) win.webContents.openDevTools({ mode: "detach" });
  // avatar load hote hi jo state hai wo bhej do
  win.webContents.on("did-finish-load", sendStateToAvatar);
  return win;
}

function startApp() {
  mainWin = createMainWindow();
  avatarWin = createAvatarWindow();
  startIdleMonitoring();

  // main window band hone par avatar bhi band, aur focus watcher bhi
  mainWin.on("closed", () => {
    focus.stop();
    stopIdleMonitoring();
    if (avatarWin && !avatarWin.isDestroyed()) avatarWin.close();
    mainWin = null;
    avatarWin = null;
    lastState = null;
    avatarOverride = null;
  });
}

app.whenReady().then(() => {
  // sirf apna app mic maange toh allow, video ya baaki permissions deny
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback, details) => {
      const types = details?.mediaTypes ?? [];
      const audioOnly = types.every((t) => t === "audio");
      const ok =
        permission === "media" &&
        audioOnly &&
        String(details?.requestingUrl || "").startsWith(APP_URL);
      callback(ok);
    }
  );
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission, origin) =>
      permission === "media" && String(origin || "").startsWith(APP_URL)
  );
  startApp();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) startApp();
  });
});

// PowerShell watcher kabhi peeche chalta na reh jaye
app.on("before-quit", () => {
  focus.stop();
  stopIdleMonitoring();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
