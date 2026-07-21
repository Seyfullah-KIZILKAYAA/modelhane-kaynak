const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

// Aynı uygulamanın birden fazla kez açılmasını engelle.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Paketlenmiş uygulamada kaynaklar app.asar.unpacked altında durur.
const appRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : path.join(__dirname, '..');

function loadEnv() {
  // .env once exe'nin yaninda aranir; boylece her cihazda ayarlar duzenlenebilir.
  const candidates = [
    path.join(path.dirname(app.getPath('exe')), '.env'),
    path.join(process.resourcesPath || '', '.env'),
    path.join(appRoot, '.env'),
  ];
  for (const file of candidates) {
    if (file && fs.existsSync(file)) {
      require('dotenv').config({ path: file });
      console.log('.env yuklendi:', file);
      return;
    }
  }
  console.warn('.env bulunamadi. Aranan yerler:', candidates);
}

function createWindow(port) {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'Modelhane Planlama',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Pencere hazır olduktan sonra güncelleme kontrolünü başlat.
    setupAutoUpdater();
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Dis baglantilar varsayilan tarayicida acilsin.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Otomatik Güncelleme ─────────────────────────────────────────────
function setupAutoUpdater() {
  // Güncellemeyi otomatik indirmeye başlama; önce kullanıcıya sor.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Ilk kontrol sirasindaki hatalar (henuz release yok, internet yok vb.)
  // kullaniciya gosterilmez; sadece indirme/kurulum hatalari bildirilir.
  let updateFlowStarted = false;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes || '',
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Guncelleme hatasi:', err);
    // Kullanici bir guncelleme baslatmadiysa sessiz kal.
    if (updateFlowStarted && mainWindow) {
      mainWindow.webContents.send('update-error', err.message || String(err));
    }
  });

  // Renderer'dan gelen IPC mesajlarini dinle.
  ipcMain.on('start-update-download', () => {
    updateFlowStarted = true;
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-and-restart', () => {
    autoUpdater.quitAndInstall();
  });

  // Güncelleme kontrolünü başlat.
  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('Guncelleme kontrolu yapilamadi:', err.message || err);
  });
}

function fatal(title, err) {
  const detail = err && err.stack ? err.stack : String(err);
  console.error(title, detail);
  dialog.showErrorBox(title, detail);
  app.quit();
}

app.whenReady().then(() => {
  loadEnv();

  const serverEntry = path.join(appRoot, 'dist', 'index.cjs');
  if (!fs.existsSync(serverEntry)) {
    return fatal('Sunucu dosyasi bulunamadi', serverEntry);
  }

  process.env.NODE_ENV = 'production';
  process.env.ELECTRON_APP = '1';
  // 0 = isletim sistemi bos bir port secsin, cakisma olmasin.
  process.env.PORT = process.env.PORT || '0';

  // Sunucu dinlemeye basladiginda portu bize bildirir.
  globalThis.__onServerListening = (port) => createWindow(port);

  try {
    require(serverEntry);
  } catch (err) {
    return fatal('Sunucu baslatilamadi', err);
  }

  // Sunucu makul surede acilmazsa kullaniciyi bilgilendir.
  setTimeout(() => {
    if (!mainWindow) {
      fatal(
        'Uygulama baslatilamadi',
        'Sunucu 30 saniye icinde hazir olmadi.\n\n' +
          'Kurulum klasorundeki .env dosyasinda yer alan SQL Server ayarlarini kontrol edin.'
      );
    }
  }, 30000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow && globalThis.__lastPort) createWindow(globalThis.__lastPort);
});
