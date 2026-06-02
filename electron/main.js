const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let mainWindow;
let miniWindow;
let normalBounds;
let miniMode = false;
let timerSnapshot = {
  time: "25:00",
  label: "专注时间"
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 900,
    minWidth: 860,
    minHeight: 720,
    title: "Tomato Focus",
    backgroundColor: "#f6f2ec",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (miniWindow) miniWindow.close();
  });
}

function enterMiniMode() {
  if (!mainWindow || miniMode) return;

  normalBounds = mainWindow.getBounds();
  miniMode = true;

  const width = 260;
  const height = 116;
  const { workArea } = screen.getDisplayMatching(normalBounds);

  miniWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 22,
    y: workArea.y + workArea.height - height - 22,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  miniWindow.loadFile(path.join(__dirname, "mini.html"));
  miniWindow.once("ready-to-show", () => {
    miniWindow.show();
    miniWindow.webContents.send("timer-snapshot", timerSnapshot);
  });
  miniWindow.on("closed", () => {
    miniWindow = null;
    if (miniMode) exitMiniMode();
  });

  mainWindow.hide();
  mainWindow.webContents.send("desktop-mini-mode", true);
}

function exitMiniMode() {
  if (!mainWindow || !miniMode) return;

  miniMode = false;
  if (miniWindow) {
    const windowToClose = miniWindow;
    miniWindow = null;
    windowToClose.close();
  }
  if (normalBounds) mainWindow.setBounds(normalBounds);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("desktop-mini-mode", false);
}

ipcMain.handle("minimize-to-top", () => {
  if (miniMode) {
    exitMiniMode();
  } else {
    enterMiniMode();
  }
});

ipcMain.on("timer-snapshot", (_event, snapshot) => {
  timerSnapshot = {
    time: snapshot?.time || timerSnapshot.time,
    label: snapshot?.label || timerSnapshot.label
  };
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send("timer-snapshot", timerSnapshot);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
