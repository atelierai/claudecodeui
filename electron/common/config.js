export const NODE_VERSION = process.env.APP_NODE_VERSION || 'v22.21.0';
export const NODE_BASE = `https://nodejs.org/dist/${NODE_VERSION}`;
export const CLI_NPM_SPEC = process.env.CLAUDE_CLI_SPEC || '@anthropic-ai/claude-code@latest';
export const NPM_REGISTRY = process.env.NPM_CONFIG_REGISTRY || undefined;
export const DOWNLOAD_TIMEOUT_MS = 60_000;
export const RETRIES = 3;

export const GIT_WIN_VERSION = process.env.APP_GIT_WINDOWS_VERSION || '2.47.1';
export const GIT_WIN_TAG = process.env.APP_GIT_WINDOWS_TAG || `v${GIT_WIN_VERSION}.windows.1`;
export const GIT_WIN_BASE = process.env.APP_GIT_WINDOWS_BASE || `https://github.com/git-for-windows/git/releases/download/${GIT_WIN_TAG}`;
