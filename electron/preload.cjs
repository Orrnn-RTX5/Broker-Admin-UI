const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rtx5Electron', {
  registerBrokerOrigins(origins = []) {
    ipcRenderer.send('rtx5:register-broker-origins', Array.isArray(origins) ? origins : [origins]);
  },
  clearBrokerOrigins() {
    ipcRenderer.send('rtx5:clear-broker-origins');
  },
  checkForUpdates() {
    return ipcRenderer.invoke('rtx5:check-for-updates');
  },
});
