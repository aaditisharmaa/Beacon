const { app, BrowserWindow, shell } = require("electron");

const APP_URL = "http://localhost:5173";

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
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
  const avatar = new BrowserWindow({
    width: 200,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  avatar.loadURL(`${APP_URL}/#/avatar`);
  return avatar;
}

function startApp() {
  const mainWin = createMainWindow();
  const avatarWin = createAvatarWindow();

  // main window band hone par avatar bhi band, warna app band hi nahi hoga
  mainWin.on("closed", () => {
    if (!avatarWin.isDestroyed()) avatarWin.close();
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