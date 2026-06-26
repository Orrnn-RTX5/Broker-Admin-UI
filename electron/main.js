import { app, BrowserWindow, session, dialog, ipcMain, Menu, nativeTheme } from 'electron';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'electron-updater';
import {
  collectBrokerOrigins,
  createCorsHeaders,
  getExtApiRedirectUrl,
  loadElectronEnv,
  normalizeOrigin,
  shouldApplyCorsHeaders,
} from './corsConfig.js';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DEV_SERVER = 'http://localhost:5173';
const APP_NAME = 'RTX5 Broker Admin';
let manualUpdateCheckInProgress = false;
let downloadedUpdateInfo = null;

loadElectronEnv({
  appRoot: path.join(__dirname, '..'),
  resourcesPath: process.resourcesPath,
  exePath: process.execPath,
});

// Broker origins are operator-supplied via env so the packaged build is not
// pinned to a single hardcoded plain-HTTP IP. Defaults preserve the historical
// fallback for existing desktop deployments that have no env override.
const API_ORIGIN =
  normalizeOrigin(
    process.env.RTX5_API_ORIGIN ||
      process.env.API_HOST ||
      process.env.VITE_API_HOST ||
      process.env.API_URL ||
      process.env.VITE_API_URL
  ) ||
  'http://69.197.178.27';
const EXT_ORIGIN =
  normalizeOrigin(
    process.env.RTX5_EXT_ORIGIN ||
      process.env.API_HOST_EXT ||
      process.env.VITE_API_HOST_EXT ||
      process.env.API_EXT_URL ||
      process.env.VITE_API_EXT_URL
  ) ||
  'http://69.197.178.27:8091';
const CONFIGURED_BROKER_ORIGINS = new Set(collectBrokerOrigins(process.env, [API_ORIGIN, EXT_ORIGIN]));
const dynamicBrokerOrigins = new Set();

const isDev = !app.isPackaged;
app.setName(APP_NAME);
nativeTheme.themeSource = 'dark';
// DevTools is always available in dev. In a packaged build it stays closed and
// the in-app toggle is disabled unless an operator explicitly opts in via
// RTX5_ENABLE_DEVTOOLS=1, so a shipped terminal does not expose DevTools (and
// the renderer's network/auth surface) to end users by default (fe-admin-ui-09).
const DEVTOOLS_ENABLED =
  isDev || /^(1|true|yes)$/i.test(String(process.env.RTX5_ENABLE_DEVTOOLS || '').trim());
const SECRET_QUERY_RE = /([?&](?:id|token|access_token|refresh_token|session|session_token|auth|authorization|jwt)=)[^&#\s]+/gi;
const BEARER_VALUE_RE = /\bBearer\s+[-._~+/=A-Za-z0-9]+/gi;

const redactUrlForLog = (value = '') =>
  String(value || '')
    .replace(BEARER_VALUE_RE, 'Bearer [REDACTED]')
    .replace(SECRET_QUERY_RE, '$1[REDACTED]');

const registerBrokerCorsOrigins = (origins = []) => {
  collectBrokerOrigins({}, Array.isArray(origins) ? origins : [origins]).forEach((origin) => {
    if (/^https?:\/\//i.test(origin)) dynamicBrokerOrigins.add(origin);
  });
};

const getAllowedBrokerOrigins = () => [
  ...CONFIGURED_BROKER_ORIGINS,
  ...dynamicBrokerOrigins,
];

function setupBrokerOriginRegistration() {
  ipcMain.on('rtx5:register-broker-origins', (_event, origins = []) => {
    registerBrokerCorsOrigins(origins);
  });

  ipcMain.on('rtx5:clear-broker-origins', () => {
    dynamicBrokerOrigins.clear();
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `${APP_NAME} v${info.version} is available. Downloading now...`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates Available',
      message: `${APP_NAME} is up to date.`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloadedUpdateInfo = info;
    promptInstallDownloadedUpdate(info);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Check Failed',
      message: err.message || 'Unable to check for updates.',
      buttons: ['OK'],
    });
  });
}

function setupDesktopIpc() {
  ipcMain.handle('rtx5:check-for-updates', () => checkForUpdatesManually());
}

const getDialogWindow = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

const showDialog = (options) => {
  const win = getDialogWindow();
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
};

function promptInstallDownloadedUpdate(info = downloadedUpdateInfo) {
  if (!info) return;

  showDialog({
      type: 'info',
      title: 'Update Ready',
      message: `${APP_NAME} v${info.version} has been downloaded. Restart now to apply the update?`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    });
}

function checkForUpdatesManually() {
  if (isDev) {
    showDialog({
      type: 'info',
      title: 'Updates Unavailable in Dev',
      message: 'Update checks are available only in packaged desktop builds.',
      buttons: ['OK'],
    });
    return;
  }

  if (downloadedUpdateInfo) {
    promptInstallDownloadedUpdate(downloadedUpdateInfo);
    return;
  }

  if (manualUpdateCheckInProgress) {
    showDialog({
      type: 'info',
      title: 'Update Check Running',
      message: 'An update check is already in progress.',
      buttons: ['OK'],
    });
    return;
  }

  manualUpdateCheckInProgress = true;
  autoUpdater
    .checkForUpdates()
    .catch((err) => {
      console.error('Manual update check failed:', err.message);
    })
    .finally(() => {
      manualUpdateCheckInProgress = false;
    });
}

function createApplicationMenu() {
  const viewSubmenu = [
    { role: 'reload' },
    { role: 'forceReload' },
  ];

  if (DEVTOOLS_ENABLED) {
    viewSubmenu.push({ role: 'toggleDevTools' });
  }

  viewSubmenu.push(
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  );

  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: viewSubmenu,
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: checkForUpdatesManually,
        },
        { type: 'separator' },
        {
          label: `About ${APP_NAME}`,
          click: () => {
            showDialog({
              type: 'info',
              title: `About ${APP_NAME}`,
              message: APP_NAME,
              detail: `Version ${app.getVersion()}`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}


function setupProductionInterceptors() {
  const ses = session.defaultSession;

  
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      const redirectURL = getExtApiRedirectUrl(details.url, API_ORIGIN, EXT_ORIGIN);
      callback(redirectURL ? { redirectURL } : {});
    }
  );

  // CORS shim - scoped to configured broker origins plus the selected broker
  // origin registered through the preload bridge. The packaged renderer loads
  // from file://, so its browser Origin is "null"; we grant only that origin
  // and do not enable credentialed wildcard access.
  ses.webRequest.onHeadersReceived(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      if (!shouldApplyCorsHeaders(details, getAllowedBrokerOrigins())) {
        callback({});
        return;
      }

      callback({
        responseHeaders: createCorsHeaders(details.responseHeaders),
      });
    }
  );
}

function createWindow() {
  const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const distRootPath = path.dirname(distIndexPath);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: APP_NAME,
    backgroundColor: '#1e1e1e',
    darkTheme: true,
    icon: isDev 
      ? path.join(__dirname, '..', 'public', 'logo V2.ico')
      : path.join(__dirname, '..', 'dist', 'logo V2.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: false,
    show: false,
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isAllowedDevUrl = isDev && navigationUrl.startsWith(DEV_SERVER);
      const packagedRelativePath =
        !isDev && parsedUrl.protocol === 'file:'
          ? path.relative(distRootPath, fileURLToPath(navigationUrl))
          : '..';
      const isAllowedPackagedFile =
        !isDev &&
        parsedUrl.protocol === 'file:' &&
        (packagedRelativePath === '' ||
          (!packagedRelativePath.startsWith('..') && !path.isAbsolute(packagedRelativePath)));

      if (!isAllowedDevUrl && !isAllowedPackagedFile) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL(DEV_SERVER);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(distIndexPath);
  }

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crashed]', details);
    if (DEVTOOLS_ENABLED) win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, redactUrlForLog(url));
    if (DEVTOOLS_ENABLED) win.webContents.openDevTools({ mode: 'detach' });
  });
  win.webContents.on('before-input-event', (_e, input) => {
    if (!DEVTOOLS_ENABLED) return;
    const isToggle =
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      input.key === 'F12';
    if (isToggle) win.webContents.toggleDevTools();
  });

  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (e) => e.preventDefault());
}


app.whenReady().then(() => {
  setupDesktopIpc();

  if (!isDev) {
    setupBrokerOriginRegistration();
    setupProductionInterceptors();
    setupAutoUpdater();
  }
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
