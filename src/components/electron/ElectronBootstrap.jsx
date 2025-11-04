import React, { useEffect, useMemo, useState } from 'react';

const termsLinks = [
  { label: 'Anthropic Commercial Terms', href: 'https://www.anthropic.com/legal/commercial-terms' },
  { label: 'Anthropic Privacy Policy', href: 'https://www.anthropic.com/legal/privacy' }
];

const electronAPI = typeof window !== 'undefined' ? window.api : undefined;

export default function ElectronBootstrap({ initialStatus, onReady }) {
  const [accepted, setAccepted] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [logs, setLogs] = useState([]);
  const [manifest, setManifest] = useState(initialStatus?.manifest ?? null);
  const [manifestError, setManifestError] = useState(initialStatus?.error ?? null);
  const [serverStarting, setServerStarting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [manifestPath, setManifestPath] = useState(initialStatus?.manifestPath ?? null);

  const statuses = useMemo(
    () => [
      { label: '条款同意', ok: accepted },
      { label: '环境准备', ok: !!manifest }
    ],
    [accepted, manifest]
  );

  useEffect(() => {
    if (!initialStatus) return;
    setManifest(initialStatus.manifest ?? null);
    setManifestError(initialStatus.error ?? null);
    setManifestPath(initialStatus.manifestPath ?? null);
  }, [initialStatus]);

  useEffect(() => {
    if (!electronAPI) return;

    let logUnsub;
    electronAPI.getTerms().then((t) => setAccepted(!!t?.accepted));

    const attach = () => {
      logUnsub = electronAPI.onBootstrapLog((line) => {
        setLogs((prev) => [...prev, line]);
      });
    };
    attach();

    const refresh = async () => {
      const res = await electronAPI.getRuntimeEnv();
      if (res?.ok) {
        setManifest(res.manifest);
        setManifestError(null);
        setManifestPath(res.manifestPath);
      } else {
        setManifest(null);
        setManifestError(res?.error || '尚未生成运行环境信息');
        setManifestPath(res?.manifestPath ?? null);
      }
    };
    refresh();

    return () => {
      logUnsub?.();
    };
  }, []);

  useEffect(() => {
    if (!electronAPI || !manifest) return;

    let cancelled = false;
    const ensureServer = async () => {
      setServerStarting(true);
      setServerError(null);
      const res = await electronAPI.startServer();
      if (cancelled) return;
      setServerStarting(false);
      if (res?.ok) {
        onReady?.(manifest);
      } else {
        setServerError(res?.error || '无法启动本地服务');
      }
    };

    ensureServer();
    return () => {
      cancelled = true;
    };
  }, [manifest, onReady]);

  const handleAccept = async () => {
    if (!electronAPI) return;
    await electronAPI.acceptTerms();
    setAccepted(true);
  };

  const handlePrepare = async () => {
    if (!electronAPI || !accepted) return;
    setBootstrapping(true);
    setLogs([]);
    setManifest(null);
    setManifestError(null);
    setServerError(null);
    const res = await electronAPI.bootstrapRun();
    setBootstrapping(false);
    if (res?.ok) {
      setManifest(res.manifest);
      setManifestPath(res.manifest?.manifestPath ?? null);
    } else if (res?.error) {
      setManifestError(res.error);
    }
  };

  const handleRefresh = async () => {
    if (!electronAPI) return;
    const res = await electronAPI.getRuntimeEnv();
    if (res?.ok) {
      setManifest(res.manifest);
      setManifestError(null);
      setManifestPath(res.manifestPath);
    } else {
      setManifest(null);
      setManifestError(res?.error || '尚未生成运行环境信息');
      setManifestPath(res?.manifestPath ?? null);
    }
  };

  if (!electronAPI) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="rounded-lg border border-border px-8 py-10 text-center shadow-lg">
          <h1 className="text-2xl font-semibold">Electron Bridge Not Detected</h1>
          <p className="mt-4 text-muted-foreground">
            请通过打包后的 Claude Code Electron 应用启动，才能使用一键环境安装功能。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-8 py-10 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Private Runtime Bootstrap</p>
              <h1 className="mt-4 text-4xl font-semibold text-white">Claude Code Launcher</h1>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                自动下载并验证 Node.js、安装 Claude Code CLI（含 Windows Git 便携支持），并生成运行时
                manifest，供 Claude Code UI 和后端进程复用。
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-4 py-5">
              {statuses.map((item) => (
                <span
                  key={item.label}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                    item.ok
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                      : 'border border-amber-400/40 bg-amber-400/10 text-amber-200'
                  }`}
                >
                  <span className="text-lg">{item.ok ? '✅' : '⏳'}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Step 1</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">阅读并接受条款</h2>
              <p className="mt-2 text-sm text-slate-300">
                继续操作前，请确认你已阅读并接受以下条款。条款确认后即可使用一键准备流程。
              </p>
              <ul className="mt-5 space-y-3 text-sm text-indigo-200/90">
                {termsLinks.map((item) => (
                  <li key={item.href}>
                    <a className="hover:text-indigo-100 underline-offset-4 hover:underline" href={item.href} target="_blank" rel="noreferrer">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-400/30 hover:text-white disabled:translate-y-0 disabled:border-slate-700 disabled:bg-slate-800/80 disabled:text-slate-400 disabled:opacity-70"
                  onClick={handleAccept}
                  disabled={accepted}
                >
                  {accepted ? '已同意条款' : '同意并继续'}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Step 2</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">一键准备运行环境</h2>
              <p className="mt-2 text-sm text-slate-300">
                自动下载 Node.js {manifest?.nodeBin ? '' : 'v22.21.0'}、准备 Git（Windows）并安装最新 Claude Code CLI，
                全程输出实时日志。
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-400/30 hover:text-white disabled:translate-y-0 disabled:border-slate-700 disabled:bg-slate-800/80 disabled:text-slate-400 disabled:opacity-70"
                  onClick={handlePrepare}
                  disabled={!accepted || bootstrapping}
                >
                  {bootstrapping ? '准备中...' : '开始准备'}
                </button>
                <button
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-700/80"
                  onClick={() => setLogs([])}
                  disabled={logs.length === 0}
                >
                  清空日志
                </button>
                <button
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-700/80"
                  onClick={handleRefresh}
                >
                  刷新状态
                </button>
              </div>

              <div className="mt-6 h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 font-mono text-xs text-slate-300">
                {logs.length === 0 && <div className="text-slate-500">等待任务开始...</div>}
                {logs.map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>

              {manifestError && (
                <div className="mt-4 rounded-xl border border-rose-500/60 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {manifestError}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">进度</p>
              <h2 className="mt-3 text-xl font-semibold text-white">状态概览</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {statuses.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-slate-200"
                  >
                    <span>{item.label}</span>
                    <span className={item.ok ? 'text-emerald-300' : 'text-amber-300'}>
                      {item.ok ? '✓ 完成' : '待执行'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">后端集成</p>
              <h2 className="mt-3 text-xl font-semibold text-white">运行环境信息</h2>
              {manifest ? (
                <>
                  <p className="text-sm text-slate-300">
                    环境 manifest 已生成，可供后端进程读取：
                  </p>
                  <pre className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">{manifestPath || ''}</pre>
                  <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                    <p>CLI 路径</p>
                    <pre className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">{manifest.cliBin}</pre>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  尚未生成 manifest。完成一键准备后可自动显示。
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">启动</p>
              <h2 className="mt-3 text-xl font-semibold text-white">进入 Claude Code UI</h2>
              <p className="text-sm text-slate-300">
                检测到环境准备完成后，会自动启动本地服务并进入应用首页。
              </p>
              {serverError && (
                <div className="mt-4 rounded-xl border border-rose-500/60 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {serverError}
                </div>
              )}
              <div className="mt-4">
                <button
                  className="w-full rounded-xl border border-sky-500/60 bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-500/30 hover:text-white disabled:border-slate-700 disabled:bg-slate-800/80 disabled:text-slate-400"
                  onClick={() => manifest && setManifest({ ...manifest })}
                  disabled={!manifest || serverStarting}
                >
                  {serverStarting ? '启动服务中...' : '重新尝试进入应用'}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
