const { contextBridge, ipcRenderer } = require('electron');

// Renderer sürecine güvenli bir API sağlıyoruz.
// React tarafından `window.electronUpdater` üzerinden erişilebilir.
contextBridge.exposeInMainWorld('electronUpdater', {
  // Ana süreçten gelen güncelleme olaylarını dinler.
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_event, message) => callback(message));
  },

  // Kullanıcı "Güncelle" dediğinde indirmeyi başlatır.
  startDownload: () => {
    ipcRenderer.send('start-update-download');
  },

  // İndirme tamamlandıktan sonra yeniden başlat.
  installAndRestart: () => {
    ipcRenderer.send('install-and-restart');
  },
});
