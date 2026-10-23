const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const APP_URL = "http://localhost:5173";
const TONES = ["friendly", "nudging", "strict"];

let mainWin = null;
let avatarWin = null;
let lastState = null;

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
    avatarWin.webContents.send("avatar:state", lastState);
  }
}

// sirf main window se update lo, avatar window se nahi
ipcMain.on("avatar:update", (event, state) => {
  if (!mainWin || event.sender !== mainWin.webContents) return;
  lastState = isValidState(state) ? state : null;
  sendStateToAvatar();
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
  const win = new BrowserWindow({
    width: 280,
    height: 240,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: webPrefs(),
  });
  win.loadURL(`${APP_URL}/#/avatar`);
  // avatar load hote hi jo last state hai wo bhej do
  win.webContents.on("did-finish-load", sendStateToAvatar);
  return win;
}

function startApp() {
  mainWin = createMainWindow();
  avatarWin = createAvatarWindow();

  // main window band hone par avatar bhi band, warna app band hi nahi hoga
  mainWin.on("closed", () => {
    if (avatarWin && !avatarWin.isDestroyed()) avatarWin.close();
    mainWin = null;
    avatarWin = null;
    lastState = null;
  });
}

app.whenReady().then(() => {
  startApp();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) startApp();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});