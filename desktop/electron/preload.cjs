const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("beacon", {
  sendAvatarState: (state) => ipcRenderer.send("avatar:update", state),
  onAvatarState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("avatar:state", handler);
    return () => ipcRenderer.removeListener("avatar:state", handler);
  },
});