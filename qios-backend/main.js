const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs'); // We'll use the file system module briefly

function createWindow () {
  // Create the main browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "CHIPS:// Browser",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,   // Essential for security
      contextIsolation: true    // Essential for security
    },
    // Optional: You can add an icon file (e.g., icon.png) in your qios-backend folder
    // icon: path.join(__dirname, 'icon.png') 
  });

  // --- CRITICAL PART ---
  // Instead of a local file, we load the LIVE URL from your Render server.
  // This means every time a user opens the app, they get the latest version!
  mainWindow.loadURL('https://qios-3.onrender.com/CHIPS_Browser.html.html');

  // You can uncomment this line to open the developer tools for debugging
  // mainWindow.webContents.openDevTools();
}

// Modern Electron requires a preload script for security. We can create an empty one.
// This makes the setup foolproof.
const preloadPath = path.join(__dirname, 'preload.js');
if (!fs.existsSync(preloadPath)) {
    fs.writeFileSync(preloadPath, '');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});