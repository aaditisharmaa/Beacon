const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("beacon", {
  // main window -> avatar: tone aur message
  sendAvatarState: (state) => ipcRenderer.send("avatar:update", state),
  onAvatarState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("avatar:state", handler);
    return () => ipcRenderer.removeListener("avatar:state", handler);
  },

  // avatar: ghumana aur click
  moveAvatar: (dx, dy) => ipcRenderer.send("avatar:move", dx, dy),
  avatarClicked: () => ipcRenderer.send("avatar:click"),

  // avatar click -> main window: clipboard ka text Capture box mein
  onCaptureText: (callback) => {
    const handler = (_event, text) => callback(text);
    ipcRenderer.on("capture:text", handler);
    return () => ipcRenderer.removeListener("capture:text", handler);
  },

  // focus mode
  focusStart: (opts) => ipcRenderer.invoke("focus:start", opts),
  focusStop: () => ipcRenderer.invoke("focus:stop"),
  focusGetState: () => ipcRenderer.invoke("focus:state"),
  focusApps: () => ipcRenderer.invoke("focus:apps"),
  onFocusState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("focus:state", handler);
    return () => ipcRenderer.removeListener("focus:state", handler);
  },
    // screenshot capture
  avatarScreenshot: () => ipcRenderer.invoke("shot:avatar"),
});