import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';
import './ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// Set environment variables for server
if (!isDev) {
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '3001';
  console.log('🔧 Set production environment for server');
}

console.log('=== Electron Debug Info ===');
console.log('isDev:', isDev);
console.log('isPackaged:', app.isPackaged);
console.log('app.getAppPath():', app.getAppPath());
console.log('__dirname:', __dirname);
console.log('NODE_ENV:', process.env.NODE_ENV);

let mainWindow;

async function isPortOpen(port, host = '127.0.0.1', timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const onDone = (result) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => onDone(true));
    socket.once('timeout', () => onDone(false));
    socket.once('error', () => onDone(false));
    socket.connect(port, host);
  });
}

async function startLocalServerIfNeeded() {
  if (isDev) {
    console.log('Skipping server start in dev mode.');
    return;
  }

  const port = Number(process.env.PORT) || 3001;
  const alreadyOpen = await isPortOpen(port);
  if (alreadyOpen) {
    console.log(`Server already running on port ${port}`);
    return;
  }

  try {
    const serverEntry = path.join(app.getAppPath(), 'server', 'index.js');
    const serverUrl = pathToFileURL(serverEntry).href;
    console.log('Starting local server from:', serverEntry);
    await import(serverUrl);
    // Optionally wait a bit for the server to bind
    for (let i = 0; i < 10; i++) {
      // check every 200ms up to 2s
      // eslint-disable-next-line no-await-in-loop
      if (await isPortOpen(port)) {
        console.log(`Local server is now listening on ${port}`);
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 200));
    }
    console.warn('Server import done but port is not open yet. Continuing...');
  } catch (err) {
    console.error('Failed to start local server:', err);
  }
}

function resolveRendererHTML() {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log('Using dev server:', process.env.VITE_DEV_SERVER_URL);
    return process.env.VITE_DEV_SERVER_URL;
  }
  const htmlPath = path.join(app.getAppPath(), 'dist', 'index.html');
  console.log('Production HTML path:', htmlPath);

  // Check if file exists
  try {
    require('fs').accessSync(htmlPath, require('fs').constants.F_OK);
    console.log('✅ HTML file exists at:', htmlPath);
  } catch (error) {
    console.error('❌ HTML file NOT found at:', htmlPath);
    console.error('Error:', error);
  }

  return htmlPath;
}

async function createWindow() {
  const preloadPath = path.join(app.getAppPath(), 'electron', 'main', 'preload.cjs');
  console.log('Preload path:', preloadPath);

  // Check if preload file exists
  try {
    require('fs').accessSync(preloadPath, require('fs').constants.F_OK);
    console.log('✅ Preload file exists at:', preloadPath);
  } catch (error) {
    console.error('❌ Preload file NOT found at:', preloadPath);
    console.error('Error:', error);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-start-loading', () => {
    console.log('🔄 Started loading content');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Finished loading content');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load content:', errorCode, errorDescription);
  });

  // Add console output from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelMap = ['debug', 'info', 'warn', 'error'];
    console.log(`[Renderer ${levelMap[level]}] ${message} (line: ${line}, source: ${sourceId})`);
  });

  // Monitor network requests
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    console.log('🌐 Request:', details.method, details.url);
    callback({});
  });

  mainWindow.webContents.session.webRequest.onCompleted((details) => {
    console.log('✅ Response:', details.statusCode, details.url);
  });

  mainWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    console.error('❌ Request failed:', details.error, details.url);
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    console.log('Loading dev URL:', devUrl);
    await mainWindow.loadURL(devUrl);
    if (!process.env.VITE_ELECTRON_NO_DEVTOOLS) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    const indexPath = resolveRendererHTML();
    console.log('Loading production file:', indexPath);
    await mainWindow.loadFile(indexPath);

    // Also open DevTools in production for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  await startLocalServerIfNeeded();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
