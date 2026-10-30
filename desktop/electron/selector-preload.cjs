// desktop/electron/selector-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shot', {
  getImage: () => ipcRenderer.invoke('shot:get-image'),
  done: (rect) => ipcRenderer.send('shot:done', rect),
  cancel: () => ipcRenderer.send('shot:cancel'),
});