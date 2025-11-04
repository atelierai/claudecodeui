import { app, ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  ensureNodeRuntime,
  ensureClaudeCli,
  readEnvManifest,
  envManifestPath,
  ensureGitRuntime,
  writeEnvManifest
} from './runtime.js';

function termsPath() {
  return path.join(app.getPath('userData'), 'terms.json');
}

ipcMain.handle('terms:get', async () => {
  try {
    const p = termsPath();
    if (!fs.existsSync(p)) return { accepted: false };
    const j = JSON.parse(await fsp.readFile(p, 'utf8'));
    return { accepted: !!j.acceptedAt };
  } catch {
    return { accepted: false };
  }
});

ipcMain.handle('terms:accept', async () => {
  const p = termsPath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify({ acceptedAt: new Date().toISOString() }, null, 2));
  return true;
});

function broadcastLog(message) {
  const msg = String(message);
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('bootstrap:log', msg);
  }
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, 'bootstrap.log');
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // ignore log failures
  }
}

ipcMain.handle('bootstrap:run', async () => {
  try {
    broadcastLog('Preparing Node runtime...');
    const runtime = await ensureNodeRuntime((m) => broadcastLog(String(m)));
    broadcastLog('Checking Git installation...');
    const git = await ensureGitRuntime((m) => broadcastLog(String(m)));
    broadcastLog('Preparing Claude CLI...');
    const cli = await ensureClaudeCli(runtime, (m) => broadcastLog(String(m)));
    const manifest = await writeEnvManifest(runtime, cli, git);
    broadcastLog('Bootstrap finished.');
    return { ok: true, runtime, cli, manifest };
  } catch (e) {
    broadcastLog(`Bootstrap failed: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('runtime:getEnv', async () => {
  try {
    const manifest = await readEnvManifest();
    return { ok: true, manifest, manifestPath: envManifestPath() };
  } catch (e) {
    return { ok: false, error: e.message, manifestPath: envManifestPath() };
  }
});

let serverStartPromise = null;

function applyManifestToEnv(manifest) {
  if (!manifest) return;
  const extras = [];
  if (manifest.binDir) extras.push(manifest.binDir);
  if (manifest.gitBinDir) extras.push(manifest.gitBinDir);
  if (extras.length) {
    const delimiter = path.delimiter;
    const current = process.env.PATH || '';
    const prefix = extras.filter(Boolean).join(delimiter);
    process.env.PATH = prefix
      ? current
        ? `${prefix}${delimiter}${current}`
        : prefix
      : current;
  }
  if (manifest.cliBin) {
    process.env.CLAUDE_CLI_PATH = manifest.cliBin;
  }
  if (manifest.cliDir) {
    process.env.CLAUDE_CLI_DIR = manifest.cliDir;
  }
  if (manifest.manifestPath) {
    process.env.CLAUDE_LAUNCHER_MANIFEST = manifest.manifestPath;
  }
}

async function startServerOnce() {
  if (serverStartPromise) {
    return serverStartPromise;
  }
  serverStartPromise = (async () => {
    const manifest = await readEnvManifest();
    applyManifestToEnv(manifest);
    const serverPath = path.join(app.getAppPath(), 'server', 'index.js');
    await import(pathToFileURL(serverPath).href);
    return true;
  })();

  try {
    await serverStartPromise;
    return true;
  } catch (error) {
    serverStartPromise = null;
    throw error;
  }
}

ipcMain.handle('runtime:startServer', async () => {
  try {
    await startServerOnce();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('runtime:serverStatus', async () => {
  if (!serverStartPromise) return { started: false };
  try {
    await serverStartPromise;
    return { started: true };
  } catch (e) {
    return { started: false, error: e.message };
  }
});
