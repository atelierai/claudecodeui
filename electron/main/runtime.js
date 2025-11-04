import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import https from 'node:https';
import decompress from 'decompress';
import decompressUnzip from 'decompress-unzip';
import { NODE_VERSION, NODE_BASE, CLI_NPM_SPEC, NPM_REGISTRY, DOWNLOAD_TIMEOUT_MS, RETRIES, GIT_WIN_VERSION, GIT_WIN_BASE } from '../common/config.js';
import { app } from 'electron';
import { spawn } from 'node:child_process';

export function detectArch() {
  const plat = process.platform;
  const arch = process.arch;
  let fileBase;
  if (plat === 'win32') {
    fileBase = arch === 'arm64' ? `win-arm64` : `win-x64`;
    return { file: `${fileBase}`, ext: 'zip' };
  }
  if (plat === 'darwin') {
    fileBase = arch === 'arm64' ? `darwin-arm64` : `darwin-x64`;
  } else {
    fileBase = arch === 'arm64' ? `linux-arm64` : `linux-x64`;
  }
  return { file: `${fileBase}`, ext: 'tar.xz' };
}

export function runtimeDirs() {
  const base = path.join(app.getPath('userData'), 'runtime');
  const nodeDir = path.join(base, `node-${NODE_VERSION}`);
  const cliDir = path.join(app.getPath('userData'), 'claude-cli');
  const tmp = path.join(base, 'tmp');
  const gitDir = path.join(base, `git-${GIT_WIN_VERSION}`);
  return { base, nodeDir, cliDir, tmp, gitDir };
}

export function envManifestPath() {
  const { base } = runtimeDirs();
  return path.join(base, 'claude-env.json');
}

function ensureDirSync(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export async function download(url, dest, logger) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timeout after ${DOWNLOAD_TIMEOUT_MS}ms`));
        }, DOWNLOAD_TIMEOUT_MS);
        const file = fs.createWriteStream(dest);
        https.get(url, { signal: controller.signal }, (res) => {
          if (res.statusCode !== 200) {
            clearTimeout(timeout);
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => {
            clearTimeout(timeout);
            file.close(resolve);
          });
        }).on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return;
    } catch (e) {
      logger && logger(`download failed (attempt ${attempt}): ${e.message}`);
      if (attempt === RETRIES) throw e;
    }
  }
}

export async function fetchText(url) {
  return await new Promise((resolve, reject) => {
    let data = '';
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const rs = fs.createReadStream(file);
  return new Promise((resolve, reject) => {
    rs.on('data', (d) => hash.update(d));
    rs.on('end', () => resolve(hash.digest('hex')));
    rs.on('error', reject);
  });
}

export async function verifyWithShasums(archivePath, shasumsText, fileName) {
  const expected = shasumsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => l.endsWith(` ${fileName}`) || l.endsWith(`  ${fileName}`));
  if (!expected) throw new Error(`Cannot find shasum for ${fileName}`);
  const expectedHash = expected.split(/\s+/)[0];
  const actual = await sha256File(archivePath);
  if (expectedHash.toLowerCase() !== actual.toLowerCase()) {
    throw new Error(`SHA256 mismatch: expected ${expectedHash}, got ${actual}`);
  }
}

export async function extractArchive(archivePath, outDir) {
  await fsp.mkdir(outDir, { recursive: true });
  if (archivePath.endsWith('.zip')) {
    await decompress(archivePath, outDir, { plugins: [decompressUnzip()] });
    return;
  }
  if (archivePath.endsWith('.tar.xz')) {
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xf', archivePath, '-C', outDir]);
      tar.on('error', reject);
      tar.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tar exited ${code}`))));
    });
    return;
  }
  throw new Error(`Unsupported archive format for ${archivePath}`);
}

function marker(dir) {
  return path.join(dir, '.install-complete');
}

function which(cmd) {
  const envPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const candidates = envPath.split(sep).filter(Boolean).map((p) => path.join(p, cmd));
  if (process.platform === 'win32') {
    const exts = process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.exe', '.cmd', '.bat'];
    for (const candidate of candidates) {
      for (const ext of exts) {
        const full = candidate.endsWith(ext) ? candidate : `${candidate}${ext}`;
        if (fs.existsSync(full)) return full;
      }
    }
    return undefined;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

function findNodeBin(nodeDir) {
  const platform = process.platform;
  if (platform === 'win32') {
    const extractedDir = fs.readdirSync(nodeDir, { withFileTypes: true }).find((d) => d.isDirectory());
    if (!extractedDir) throw new Error(`Cannot find extracted node directory in ${nodeDir}`);
    const root = path.join(nodeDir, extractedDir.name);
    return {
      nodeRoot: root,
      nodeBin: path.join(root, 'node.exe'),
      npmCli: path.join(root, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      npmCmd: path.join(root, 'npm.cmd'),
      binDir: root
    };
  }
  const extractedDir = fs.readdirSync(nodeDir).find((name) => name.startsWith('node-'));
  const root = path.join(nodeDir, extractedDir || '');
  const binDir = path.join(root, 'bin');
  return {
    nodeRoot: root,
    nodeBin: path.join(binDir, 'node'),
    npmCli: path.join(root, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    npmCmd: undefined,
    binDir
  };
}

function prependToProcessPath(dir) {
  if (!dir) return;
  const sep = process.platform === 'win32' ? ';' : ':';
  const current = process.env.PATH || '';
  const entries = current.split(sep).filter(Boolean);
  if (!entries.includes(dir)) {
    process.env.PATH = `${dir}${sep}${current}`;
  }
}

async function getNodeExecPathFromCommand() {
  return await new Promise((resolve) => {
    const child = spawn('node', ['-p', 'process.execPath'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout && child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => resolve(undefined));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(out.trim());
      } else {
        resolve(undefined);
      }
    });
  });
}

export async function ensureNodeRuntime(logger = () => {}) {
  const nodeOnPath = which('node');
  if (nodeOnPath) {
    const execPath = await getNodeExecPathFromCommand();
    const nodeBin = execPath && fs.existsSync(execPath) ? execPath : nodeOnPath;
    const binDir = path.dirname(nodeBin);
    const npmCmd = which(process.platform === 'win32' ? 'npm.cmd' : 'npm') || which('npm');
    if (npmCmd) {
      logger(`Using system Node from ${binDir}`);
      prependToProcessPath(binDir);
      return { nodeDir: binDir, nodeRoot: binDir, nodeBin, npmCli: undefined, npmCmd, binDir };
    }
    logger('System Node found but npm not detected; provisioning private Node to obtain npm.');
  }

  const { nodeDir, tmp } = runtimeDirs();
  ensureDirSync(nodeDir);
  ensureDirSync(tmp);
  if (fs.existsSync(marker(nodeDir))) {
    logger('Node runtime already present.');
    const found = findNodeBin(nodeDir);
    prependToProcessPath(found.binDir);
    return { nodeDir, ...found };
  }
  const { file, ext } = detectArch();
  const name = `node-${NODE_VERSION}-${file}.${ext}`;
  const url = `${NODE_BASE}/${name}`;
  const shasumsUrl = `${NODE_BASE}/SHASUMS256.txt`;
  const archivePath = path.join(tmp, name);
  logger(`Downloading Node: ${url}`);
  await download(url, archivePath, logger);
  logger('Downloading SHASUMS256.txt');
  const shasums = await fetchText(shasumsUrl);
  logger('Verifying SHA256...');
  await verifyWithShasums(archivePath, shasums, name);
  logger('Extracting...');
  await extractArchive(archivePath, nodeDir);
  await fsp.writeFile(marker(nodeDir), 'ok');
  const found = findNodeBin(nodeDir);
  prependToProcessPath(found.binDir);
  logger('Node runtime ready.');
  return { nodeDir, ...found };
}

async function commandExists(cmd) {
  return await new Promise((resolve) => {
    const child = spawn(cmd, ['--version']);
    let resolved = false;
    child.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        resolve(code === 0);
      }
    });
  });
}

function findGitCmdDir(gitRoot) {
  const candidates = [gitRoot];
  try {
    const entries = fs.readdirSync(gitRoot, { withFileTypes: true });
    const singleDir = entries.filter((e) => e.isDirectory());
    if (singleDir.length === 1 && fs.existsSync(path.join(gitRoot, singleDir[0].name, 'cmd'))) {
      candidates.unshift(path.join(gitRoot, singleDir[0].name));
    }
  } catch {}
  for (const root of candidates) {
    const cmdDir = path.join(root, 'cmd');
    const exe = process.platform === 'win32' ? path.join(cmdDir, 'git.exe') : path.join(cmdDir, 'git');
    if (fs.existsSync(cmdDir) && fs.existsSync(exe)) {
      return { gitRoot: root, gitCmdDir: cmdDir, gitBin: exe };
    }
  }
  throw new Error(`Git executable not found under ${gitRoot}`);
}

export async function ensureGitRuntime(logger = () => {}) {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const hasGit = await commandExists('git');
  if (hasGit) {
    logger('Git detected on PATH.');
    return undefined;
  }

  const { gitDir, tmp } = runtimeDirs();
  if (fs.existsSync(marker(gitDir))) {
    logger('Portable Git already present.');
    const found = findGitCmdDir(gitDir);
    process.env.PATH = `${found.gitCmdDir}${path.delimiter}${process.env.PATH || ''}`;
    return found;
  }

  const arch = process.arch === 'arm64' ? 'arm64' : '64';
  const archiveName = `MinGit-${GIT_WIN_VERSION}-64-bit.zip`.replace('64', arch);
  const url = `${GIT_WIN_BASE}/${archiveName}`;
  const archivePath = path.join(tmp, archiveName);
  ensureDirSync(tmp);
  ensureDirSync(gitDir);
  logger(`Downloading Git runtime: ${url}`);
  await download(url, archivePath, logger);
  logger('Extracting Git...');
  await extractArchive(archivePath, gitDir);
  await fsp.writeFile(marker(gitDir), 'ok');
  const found = findGitCmdDir(gitDir);
  process.env.PATH = `${found.gitCmdDir}${path.delimiter}${process.env.PATH || ''}`;
  logger('Git runtime ready.');
  return found;
}

function spawnPromise(cmd, args, opts = {}, logger) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe', ...opts });
    child.stdout && child.stdout.on('data', (d) => logger && logger(d.toString()));
    child.stderr && child.stderr.on('data', (d) => logger && logger(d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

function locateCli(cliDir) {
  const bin = process.platform === 'win32'
    ? path.join(cliDir, 'node_modules', '.bin', 'claude.cmd')
    : path.join(cliDir, 'node_modules', '.bin', 'claude');
  const entry = path.join(cliDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`Claude CLI entry script not found at ${entry}`);
  }
  return { cliDir, cliBin: bin, cliEntry: entry };
}

function locateGlobalCliFromBin(binPath) {
  const base = path.dirname(binPath);
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(base, '..', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
    candidates.push(path.join(base, '..', '@anthropic-ai', 'claude-code', 'cli.js'));
    candidates.push(path.join(base, '..', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
  } else {
    candidates.push(path.join(base, '..', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
    candidates.push(path.join(base, '..', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
    candidates.push(path.join(base, '..', '@anthropic-ai', 'claude-code', 'cli.js'));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const cliDir = path.dirname(c);
      return { cliDir, cliBin: binPath, cliEntry: c };
    }
  }
  return { cliDir: path.dirname(binPath), cliBin: binPath, cliEntry: path.join(path.dirname(binPath), '..', '@anthropic-ai', 'claude-code', 'cli.js') };
}

export async function writeEnvManifest(runtime, cli, git) {
  const manifestPath = envManifestPath();
  const manifest = {
    userData: app.getPath('userData'),
    runtimeDir: runtime.nodeDir,
    nodeBin: runtime.nodeBin,
    npmCli: runtime.npmCli,
    npmCmd: runtime.npmCmd,
    binDir: runtime.binDir,
    cliDir: cli.cliDir,
    cliEntry: cli.cliEntry,
    cliBin: cli.cliBin
  };
  if (git && git.gitCmdDir && git.gitBin) {
    manifest.gitDir = git.gitRoot;
    manifest.gitBin = git.gitBin;
    manifest.gitBinDir = git.gitCmdDir;
  }
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { ...manifest, manifestPath };
}

export async function readEnvManifest() {
  const manifestPath = envManifestPath();
  const raw = await fsp.readFile(manifestPath, 'utf8');
  const data = JSON.parse(raw);
  return { ...data, manifestPath };
}

export async function ensureClaudeCli(runtime, logger = () => {}) {
  const { cliDir } = runtimeDirs();
  const globalClaude = which(process.platform === 'win32' ? 'claude.cmd' : 'claude') || which('claude');
  if (globalClaude) {
    logger(`Using system Claude CLI at ${globalClaude}`);
    return locateGlobalCliFromBin(globalClaude);
  }
  await fsp.mkdir(cliDir, { recursive: true });
  const mark = marker(cliDir);
  if (fs.existsSync(mark)) {
    logger('Claude CLI already installed.');
    const existing = locateCli(cliDir);
    return existing;
  }
  logger('Installing Claude CLI via npm...');
  const env = { ...process.env };
  if (NPM_REGISTRY) env.NPM_CONFIG_REGISTRY = NPM_REGISTRY;
  const installArgs = ['install', '--prefix', cliDir, '--no-fund', '--no-audit', '--loglevel', 'error', CLI_NPM_SPEC];
  if (runtime.npmCli) {
    await spawnPromise(runtime.nodeBin, [runtime.npmCli, ...installArgs], { env }, logger);
  } else if (runtime.npmCmd) {
    await spawnPromise(runtime.npmCmd, installArgs, { env }, logger);
  } else {
    throw new Error('No npm detected to install Claude CLI');
  }
  await fsp.writeFile(mark, 'ok');
  logger('Claude CLI installed.');
  const located = locateCli(cliDir);
  return located;
}

export async function writeBootstrapManifest(runtime, cli, git) {
  return writeEnvManifest(runtime, cli, git);
}
