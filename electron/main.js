const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let mainWindow;
let normalBounds;
let miniMode = false;

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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

function enterMiniMode() {
  if (!mainWindow || miniMode) return;

  normalBounds = mainWindow.getBounds();
  miniMode = true;

  const width = 260;
  const height = 116;
  const { workArea } = screen.getDisplayMatching(normalBounds);
  mainWindow.setResizable(false);
  mainWindow.setMinimumSize(width, height);
  mainWindow.setSize(width, height);
  mainWindow.setPosition(workArea.x + workArea.width - width - 22, workArea.y + workArea.height - height - 22);
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setSkipTaskbar(true);
  mainWindow.webContents.send("desktop-mini-mode", true);
}

function exitMiniMode() {
  if (!mainWindow || !miniMode) return;

  miniMode = false;
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setSkipTaskbar(false);
  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(860, 720);
  if (normalBounds) mainWindow.setBounds(normalBounds);
  mainWindow.webContents.send("desktop-mini-mode", false);
}

ipcMain.handle("minimize-to-top", () => {
  if (miniMode) {
    exitMiniMode();
  } else {
    enterMiniMode();
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
