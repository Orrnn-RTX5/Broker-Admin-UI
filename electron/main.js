import { app, BrowserWindow, session, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DEV_SERVER = 'http://localhost:5173';
const API_ORIGIN = 'http://69.197.178.27';       
const EXT_ORIGIN = 'http://69.197.178.27:8091';  

const isDev = !app.isPackaged;


function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `RTX5 Admin v${info.version} is available. Downloading now...`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `v${info.version} has been downloaded. Restart now to apply the update?`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true);
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}


function setupProductionInterceptors() {
  const ses = session.defaultSession;

  
  ses.webRequest.onBeforeRequest(
    { urls: [`${API_ORIGIN}/ext-api/*`] },
    (details, callback) => {
      const redirectURL = details.url.replace(`${API_ORIGIN}/ext-api`, EXT_ORIGIN);
      callback({ redirectURL });
    }
  );

  
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin':  ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
      },
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'RTX5 Admin',
    backgroundColor: '#1e1e1e',
    icon: isDev 
      ? path.join(__dirname, '..', 'public', 'logo V2.ico')
      : path.join(__dirname, '..', 'dist', 'logo V2.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
    show: false,
  });

  if (isDev) {
    win.loadURL(DEV_SERVER);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crashed]', details);
    win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, url);
    win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('before-input-event', (_e, input) => {
    const isToggle =
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      input.key === 'F12';
    if (isToggle) win.webContents.toggleDevTools();
  });

  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (e) => e.preventDefault());
}


app.whenReady().then(() => {
  if (!isDev) {
    setupProductionInterceptors();
    setupAutoUpdater();
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
