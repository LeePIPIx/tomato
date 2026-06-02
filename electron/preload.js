const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tomatoDesktop", {
  minimizeToTop: () => ipcRenderer.invoke("minimize-to-top"),
  onMiniMode: (callback) => {
    ipcRenderer.on("desktop-mini-mode", (_event, enabled) => callback(Boolean(enabled)));
  }
});
