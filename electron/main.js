const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = () => path.join(app.getPath('userData'), 'iqra-finance-data.json');

function loadDataFromDisk() {
  try {
    const raw = fs.readFileSync(DATA_FILE(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null; // no file yet, or unreadable — renderer will fall back to defaults
  }
}

function saveDataToDisk(data) {
  const file = DATA_FILE();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file); // atomic-ish write to avoid corrupting the data file if the app closes mid-save
  return true;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f6f7fb',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) console.log(`[renderer ${level===2?'warn':'error'}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error('Renderer failed to load:', code, desc);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
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

/* ---- IPC: main data file ---- */
ipcMain.handle('data:load', () => loadDataFromDisk());
ipcMain.handle('data:save', (event, data) => saveDataToDisk(data));

/* ---- IPC: native backup export/import dialogs ---- */
ipcMain.handle('data:exportBackup', async (event, jsonString) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Backup',
    defaultPath: `iqra_finance_backup_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, jsonString, 'utf-8');
  return { ok: true, filePath };
});

ipcMain.handle('data:importBackup', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { ok: true, content };
});

/* ---- IPC: CSV export via native save dialog ---- */
ipcMain.handle('data:exportCSV', async (event, { filename, csv }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export CSV',
    defaultPath: filename,
    filters: [{ name: 'CSV File', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, csv, 'utf-8');
  return { ok: true, filePath };
});
