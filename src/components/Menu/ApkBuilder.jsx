import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';

/**
 * 手机安装包（APK）生成器
 *
 * 浏览器无法自己编译 APK，所以这里调用电脑上跑的构建服务（server/build-apk.mjs，
 * 默认 127.0.0.1:8890，经 Vite 的 /build-api 代理转发）。
 * 在手机 APK 里打开时该服务不存在，会退化为「需在电脑上操作」的提示。
 */
const API = '/build-api';

export default function ApkBuilder() {
  const [health, setHealth] = useState(null); // null=检测中 / {ok, missing, busy}
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState('');
  const timer = useRef(null);

  const stopPolling = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API}/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth(await res.json());
    } catch {
      setHealth({ ok: false, unreachable: true, missing: [] });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // 刷新页面后恢复上次构建结果（服务端保存的是最近一次任务）
    (async () => {
      try {
        const res = await fetch(`${API}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.jobId && data.state === 'done') setJob(data);
      } catch { /* 服务未启动，忽略 */ }
    })();
    return stopPolling;
  }, [checkHealth]);

  const poll = useCallback((jobId) => {
    stopPolling();
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setJob(data);
        if (data.state === 'done' || data.state === 'error' || data.state === 'cancelled') {
          stopPolling();
          checkHealth();
        }
      } catch (e) {
        stopPolling();
        setError(`进度查询失败：${e.message}`);
      }
    }, 1000);
  }, [checkHealth]);

  const startBuild = async () => {
    setError('');
    setJob(null);
    setStarting(true);
    try {
      const res = await fetch(`${API}/build`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setJob({ jobId: data.jobId, state: 'queued', percent: 0, stageLabel: '排队中', log: [] });
      poll(data.jobId);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!job?.jobId) return;
    try { await fetch(`${API}/cancel?jobId=${encodeURIComponent(job.jobId)}`, { method: 'POST' }); } catch { /* ignore */ }
  };

  /** 在资源管理器中打开并选中 APK —— 用户可直接把文件拖进 QQ / 微信 */
  const revealFile = async () => {
    if (!job?.jobId) return;
    try {
      const res = await fetch(`${API}/reveal?jobId=${encodeURIComponent(job.jobId)}`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setCopied('已打开文件夹，把文件拖进 QQ / 微信即可');
    } catch (e) {
      setError(`打开文件夹失败：${e.message}`);
    }
  };

  const copyPath = async () => {
    const p = job?.apk?.path;
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p);
      setCopied('路径已复制');
    } catch {
      setCopied(p);
    }
  };

  const running = job && (job.state === 'running' || job.state === 'queued');

  return (
    <div className="panel settings-section">
      <h3><Icon name="package" size={16} /><span>手机 APK · 一键打包</span></h3>

      {health === null && <p className="settings-tip">正在检测构建环境…</p>}

      {health?.unreachable && (
        <p className="settings-tip apk-warn">
          没有连上构建服务。生成安装包需要在<strong>电脑上</strong>运行游戏（双击桌面
          CardGameMaker），手机里打开的 APK 无法自己打包。
        </p>
      )}

      {health && !health.unreachable && !health.ok && (
        <div className="apk-warn">
          <p className="settings-tip">构建环境不完整，缺少：</p>
          <ul className="apk-missing">
            {health.missing.map(m => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {health?.ok && (
        <>
          <p className="settings-tip">
            点一下就会自动跑完全部流程：<strong>同步图标 → 构建网页 → 同步到 Android 工程 → 编译签名 APK</strong>。
            版本号自动递增，旧包自动清理，你只需要更新游戏内容，不用再碰任何 APK 配置。
          </p>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-small btn-primary" onClick={startBuild} disabled={running || starting}>
              <Icon name="package" size={14} />
              {running ? '正在打包…' : starting ? '准备中…' : '生成安装包'}
            </button>
            {running && <button className="btn btn-small" onClick={cancel}>取消</button>}
          </div>
        </>
      )}

      {error && <p className="apk-error">{error}</p>}

      {job && (
        <div className="apk-progress">
          <div className="apk-bar">
            <div className="apk-bar-fill" style={{ width: `${job.percent || 0}%` }} />
          </div>
          <div className="apk-meta">
            <span>{job.stageLabel || job.state}</span>
            <span>{job.percent || 0}%</span>
          </div>

          {job.state === 'done' && job.apk && (
            <div className="apk-done">
              <div
                className="apk-file-card"
                draggable
                title="可拖到桌面；发到 QQ/微信请点「在文件夹中显示」"
                onDragStart={(e) => {
                  const url = new URL(`${API}/download?jobId=${encodeURIComponent(job.jobId)}`, window.location.origin).toString();
                  e.dataTransfer.setData('DownloadURL', `application/vnd.android.package-archive:${job.apk.name}:${url}`);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <div className="apk-file-icon">APK</div>
                <div className="apk-file-info">
                  <div className="apk-file-name">{job.apk.name}</div>
                  <div className="apk-file-meta">
                    {(job.apk.size / 1024 / 1024).toFixed(1)} MB · build {job.apk.versionCode}
                  </div>
                </div>
              </div>

              <div className="btn-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-small btn-primary" onClick={revealFile}>
                  <Icon name="package" size={14} />
                  在文件夹中显示
                </button>
                <a className="btn btn-small"
                   href={`${API}/download?jobId=${encodeURIComponent(job.jobId)}`}
                   download={job.apk.name}>
                  下载
                </a>
                <button className="btn btn-small" onClick={copyPath}>复制路径</button>
              </div>

              <p className="settings-tip apk-share-tip">
                <strong>发到 QQ / 微信：</strong>点「在文件夹中显示」，资源管理器会打开并选中这个文件，
                直接把它<strong>拖进</strong> QQ 或微信聊天窗口就能发送。
                <br />
                网页里的文件没法直接拖到其他程序（浏览器安全限制），所以需要从文件夹拖。
              </p>

              {copied && <p className="apk-copied">{copied}</p>}

              <p className="settings-tip" style={{ marginTop: 6 }}>
                对方收到后点安装（需允许「安装未知来源应用」）。
                同签名证书的 APK 可直接覆盖升级，不用先卸载。
              </p>
            </div>
          )}

          {job.state === 'error' && (
            <p className="apk-error">打包失败：{job.error}</p>
          )}

          {job.log?.length > 0 && (
            <details className="apk-log">
              <summary>构建日志（{job.log.length} 行）</summary>
              <pre>{job.log.map(l => l.text).join('\n')}</pre>
            </details>
          )}
        </div>
      )}

      <style>{`
        .apk-warn { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .apk-missing { margin: 4px 0 0 18px; font-size: 11.5px; color: #e0a04a; }
        .apk-error { margin-top: 10px; font-size: 12px; color: #e2645f; line-height: 1.5; }
        .apk-progress { margin-top: 14px; }
        .apk-bar {
          height: 8px; border-radius: 4px; overflow: hidden;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(212,175,55,0.25);
        }
        .apk-bar-fill {
          height: 100%; background: linear-gradient(90deg, #b8912f, #e8cf7a);
          transition: width 0.4s ease;
        }
        .apk-meta {
          display: flex; justify-content: space-between; margin-top: 6px;
          font-size: 11.5px; color: var(--text-secondary);
        }
        .apk-done { margin-top: 12px; }
        .apk-file-card {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 8px; cursor: grab;
          background: rgba(212,175,55,0.07);
          border: 1px solid rgba(212,175,55,0.3);
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .apk-file-card:hover {
          border-color: rgba(212,175,55,0.65);
          background: rgba(212,175,55,0.12);
        }
        .apk-file-card:active { cursor: grabbing; }
        .apk-file-icon {
          flex: 0 0 auto; width: 38px; height: 38px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
          color: #1b1408; background: linear-gradient(160deg, #e8cf7a, #b8912f);
        }
        .apk-file-info { min-width: 0; }
        .apk-file-name {
          font-size: 12.5px; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .apk-file-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .apk-share-tip {
          margin-top: 10px; padding: 8px 10px; border-radius: 6px;
          background: rgba(212,175,55,0.08);
          border-left: 2px solid rgba(212,175,55,0.5);
        }
        .apk-copied { margin-top: 8px; font-size: 11.5px; color: #7fb37f; word-break: break-all; }
        .apk-log { margin-top: 12px; font-size: 11px; color: var(--text-secondary); }
        .apk-log summary { cursor: pointer; opacity: 0.8; }
        .apk-log pre {
          margin-top: 6px; max-height: 180px; overflow: auto; padding: 8px;
          background: rgba(0,0,0,0.35); border-radius: 6px;
          font-size: 10.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;
        }
      `}</style>
    </div>
  );
}
