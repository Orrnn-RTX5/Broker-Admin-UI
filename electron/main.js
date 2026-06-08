import { app, BrowserWindow, session, dialog, ipcMain } from 'electron';
import process from 'node:process';
import path from 'path';
import { fileURLToPath } from 'url';
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

loadElectronEnv({
  appRoot: path.join(__dirname, '..'),
  resourcesPath: process.resourcesPath,
  exePath: process.execPath,
});

// Broker origins are operator-supplied via env so the packaged build is not
// pinned to a single hardcoded plain-HTTP IP. Defaults preserve the historical
// fallback for existing desktop deployments that have no env override.
const API_ORIGIN =
  normalizeOrigin(process.env.RTX5_API_ORIGIN || process.env.API_HOST || process.env.VITE_API_HOST) ||
  'http://69.197.178.27';
const EXT_ORIGIN =
  normalizeOrigin(process.env.RTX5_EXT_ORIGIN || process.env.API_HOST_EXT || process.env.VITE_API_HOST_EXT) ||
  'http://69.197.178.27:8091';
const CONFIGURED_BROKER_ORIGINS = new Set(collectBrokerOrigins(process.env, [API_ORIGIN, EXT_ORIGIN]));
const dynamicBrokerOrigins = new Set();

const isDev = !app.isPackaged;
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
  if (!isDev) {
    setupBrokerOriginRegistration();
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
