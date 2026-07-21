const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportBackup: (jsonString) => ipcRenderer.invoke('data:exportBackup', jsonString),
  importBackup: () => ipcRenderer.invoke('data:importBackup'),
  exportCSV: (filename, csv) => ipcRenderer.invoke('data:exportCSV', { filename, csv }),
});
