const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tomatoDesktop", {
  minimizeToTop: () => ipcRenderer.invoke("minimize-to-top"),
  restoreFromMini: () => ipcRenderer.invoke("restore-from-mini"),
  windowAction: (action) => ipcRenderer.invoke("window-action", action),
  miniDragStart: () => ipcRenderer.invoke("mini-drag-start"),
  miniDragMove: (position) => ipcRenderer.invoke("mini-drag-move", position),
  updateTimer: (snapshot) => ipcRenderer.send("timer-snapshot", snapshot),
  onMiniMode: (callback) => {
    ipcRenderer.on("desktop-mini-mode", (_event, enabled) => callback(Boolean(enabled)));
  },
  onTimerSnapshot: (callback) => {
    ipcRenderer.on("timer-snapshot", (_event, snapshot) => callback(snapshot));
  }
});
