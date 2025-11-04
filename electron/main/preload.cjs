const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script loaded');

contextBridge.exposeInMainWorld('api', {
  getTerms: () => ipcRenderer.invoke('terms:get'),
  acceptTerms: () => ipcRenderer.invoke('terms:accept'),
  bootstrapRun: () => ipcRenderer.invoke('bootstrap:run'),
  onBootstrapLog: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('bootstrap:log', handler);
    return () => ipcRenderer.off('bootstrap:log', handler);
  },
  getRuntimeEnv: () => ipcRenderer.invoke('runtime:getEnv'),
  startServer: () => ipcRenderer.invoke('runtime:startServer'),
  getServerStatus: () => ipcRenderer.invoke('runtime:serverStatus')
});
