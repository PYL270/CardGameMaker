import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from '../ui/Icon';
import MobileNotice from './MobileNotice';
import { isMobileApp, isMobileDevice } from '../../utils/mobile';

export const APK_API = {
  status: '/api/mobile/status',
  build: '/api/mobile/build',
  latest: '/apk/latest.json',
};
export const FALLBACK_APP_VERSION = '1.0.0';

function clampProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeApkInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || raw.path || raw.stableUrl || (raw.file ? `/apk/${raw.file}` : ''));
  if (!url) return null;
  return {
    file: String(raw.file || url.split('/').pop() || 'CardGameMaker.apk'),
    size: Math.max(0, Number(raw.size) || 0),
    version: String(raw.version || ''),
    url,
    stableUrl: String(raw.stableUrl || ''),
    sha256: String(raw.sha256 || ''),
    mtime: Number(raw.mtime) || (raw.builtAt ? Date.parse(raw.builtAt) : 0) || 0,
  };
}

export function normalizeApiStatus(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    available: src.available !== false,
    building: src.building === true,
    progress: clampProgress(src.progress),
    log: Array.isArray(src.log) ? src.log.map(String).filter(Boolean) : [],
    apk: normalizeApkInfo(src.apk),
    stableUrl: String(src.stableUrl || src.apk?.stableUrl || ''),
    history: normalizeHistory(src.history || src.apk?.history),
    version: String(src.version || src.apk?.version || ''),
  };
}

/** history 兼容字符串 URL / {version,file,size,url,mtime}；最多保留 5 项 */
export function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map(item => {
      if (typeof item === 'string') return normalizeApkInfo({ url: item });
      return normalizeApkInfo(item);
    })
    .filter(Boolean);
}

/** /apk/latest.json 兼容 { version, apk:{...}, stableUrl, history } 与直接 APK 信息两种形态 */
export function normalizeLatest(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const apk = normalizeApkInfo(src.apk || (src.url || src.file ? src : null));
  return {
    version: String(src.version || apk?.version || ''),
    apk,
    stableUrl: String(src.stableUrl || src.apk?.stableUrl || apk?.stableUrl || ''),
    history: normalizeHistory(src.history || src.apk?.history),
  };
}

export function buildApkUrl(url, origin = '') {
  const text = String(url || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}${text.startsWith('/') ? text : `/${text}`}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatBuildTime(mtime) {
  const n = Number(mtime);
  if (!Number.isFinite(n) || n <= 0) return '—';
  try {
    return new Date(n).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '—';
  }
}

export function tailLog(log, count = 8) {
  return (Array.isArray(log) ? log : []).map(String).filter(Boolean).slice(-Math.max(1, count));
}

/**
 * 设置页「手机 APK」面板。previewOnly / initial* 仅用于 SSR 测试，生产环境自动请求构建接口。
 */
export default function MobileApkPanel({
  previewOnly = false,
  initialStatus = null,
  initialLatest = null,
  initialError = '',
  initialLoading = null,
  forceMobile = null,
}) {
  const seededStatus = initialStatus ? normalizeApiStatus(initialStatus) : null;
  const seededLatest = initialLatest ? normalizeLatest(initialLatest) : null;
  const mobile = forceMobile === null ? (isMobileApp() || isMobileDevice()) : !!forceMobile;

  const [loading, setLoading] = useState(
    initialLoading !== null ? initialLoading : (!previewOnly && !seededStatus && !seededLatest && !initialError),
  );
  const [available, setAvailable] = useState(seededStatus ? seededStatus.available : null);
  const [building, setBuilding] = useState(seededStatus ? seededStatus.building : false);
  const [progress, setProgress] = useState(seededStatus ? seededStatus.progress : 0);
  const [log, setLog] = useState(seededStatus ? seededStatus.log : []);
  const [apk, setApk] = useState(seededStatus?.apk || seededLatest?.apk || null);
  const [stableUrl, setStableUrl] = useState(seededLatest?.stableUrl || seededStatus?.stableUrl || '');
  const [history, setHistory] = useState(seededLatest?.history || seededStatus?.history || []);
  const [version, setVersion] = useState(seededLatest?.version || seededStatus?.apk?.version || FALLBACK_APP_VERSION);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [qrData, setQrData] = useState('');
  const [buildingBusy, setBuildingBusy] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const stableSource = stableUrl || apk?.stableUrl || apk?.url || '';
  const downloadUrl = buildApkUrl(stableSource, origin);
  const historyUrl = (item) => buildApkUrl(item?.stableUrl || item?.url, origin);

  const applyStatus = (raw) => {
    const next = normalizeApiStatus(raw);
    setAvailable(next.available);
    setBuilding(next.building);
    setProgress(next.progress);
    setLog(next.log);
    if (next.apk) {
      setApk(next.apk);
      if (next.apk.version) setVersion(next.apk.version);
    }
    if (next.stableUrl) setStableUrl(next.stableUrl);
    if (next.history?.length) setHistory(next.history);
    setLoading(false);
    if (!next.building) setBuildingBusy(false);
  };

  const loadLatestFallback = async () => {
    try {
      const response = await fetch(APK_API.latest, { cache: 'no-store' });
      if (!response.ok) return false;
      const latest = normalizeLatest(await response.json());
      if (latest.apk) {
        setApk(latest.apk);
        setVersion(latest.version || latest.apk.version || FALLBACK_APP_VERSION);
        if (latest.stableUrl) setStableUrl(latest.stableUrl);
        if (latest.history?.length) setHistory(latest.history);
        setAvailable(false);
        setNotice('构建接口不可用（生产模式或服务未启动）：可下载最新包；需要重新打包请在电脑端项目目录执行 npm run apk。');
        setLoading(false);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const loadStatus = async () => {
    try {
      const response = await fetch(APK_API.status, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      applyStatus(data);
      setError('');
      setNotice('');
      return true;
    } catch {
      const found = await loadLatestFallback();
      if (!found) {
        setAvailable(false);
        setError('构建服务不可用：请在电脑端项目目录执行 npm run apk，或启动 dev server 后重试。');
        setLoading(false);
      }
      return false;
    }
  };

  useEffect(() => {
    if (previewOnly) return undefined;
    let cancelled = false;
    loadStatus().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOnly]);

  useEffect(() => {
    if (previewOnly || !building) return undefined;
    const timer = setInterval(() => { loadStatus(); }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, previewOnly]);

  useEffect(() => {
    if (previewOnly || !downloadUrl) return undefined;
    let cancelled = false;
    QRCode.toDataURL(downloadUrl, {
      margin: 1,
      width: 180,
      color: { dark: '#1b1509', light: '#f2e6c8' },
    }).then(data => { if (!cancelled) setQrData(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [downloadUrl, previewOnly]);

  const handleBuild = async () => {
    if (building || mobile) return;
    setError('');
    setNotice('');
    setBuildingBusy(true);
    try {
      const response = await fetch(APK_API.build, { method: 'POST' });
      if (response.status === 409) {
        setBuilding(true);
        setNotice('已有打包任务进行中，正在刷新进度…');
        loadStatus();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBuilding(true);
      setProgress(0);
      setNotice('正在打包当前代码与资源…');
      loadStatus();
    } catch {
      setBuildingBusy(false);
      setError('构建服务不可用：请在电脑端项目目录执行 npm run apk，或启动 dev server 后重试。');
    }
  };

  const copyLink = async () => {
    if (!downloadUrl) return;
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setNotice('下载链接已复制到剪贴板');
    } catch {
      setNotice(`复制失败，请手动复制：${downloadUrl}`);
    }
  };

  const logTail = tailLog(log, 8);

  return (
    <div className="panel settings-section apk-panel" id="mobile-apk">
      <h3><Icon name="package" size={16} /><span>手机 APK</span></h3>
      <p className="apk-explainer">
        自动打包当前代码与资源，自动生成版本号/文件名；无需修改 APK 配置；旧包自动保留最近 5 个。
      </p>
      <div className="apk-head-row">
        <span className="apk-version">当前版本 v{version}</span>
        <span className={`apk-state ${building ? 'building' : apk ? 'ready' : 'empty'}`}>
          {building ? '正在打包' : apk ? '已有安装包' : '未打包'}
        </span>
      </div>

      {mobile ? (
        <div className="apk-mobile-note">
          手机版内不支持一键打包。请到电脑端打开「设置 → 手机 APK」打包；安装包可分享给手机安装。
        </div>
      ) : (
        <div className="apk-actions-row">
          <button
            type="button"
            className="btn btn-small btn-primary apk-build-btn"
            onClick={handleBuild}
            disabled={building || buildingBusy || loading}
            title="自动打包当前代码与资源，无需手动配置">
            <Icon name={building ? 'refresh' : 'package'} size={14} />
            {building ? '正在打包…' : '一键打包'}
          </button>
          <button type="button" className="btn btn-small" onClick={loadStatus} disabled={loading}>
            重新检查
          </button>
        </div>
      )}

      {loading && <p className="apk-loading">正在检查构建服务…</p>}
      {building && (
        <div className="apk-progress-wrap">
          <div className="apk-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="apk-progress-label">{progress}%</span>
          <span className="apk-building-text">正在打包…</span>
        </div>
      )}
      {error && <p className="apk-error">{error}</p>}
      {notice && <p className="apk-notice">{notice}</p>}
      {available === false && !apk && !error && (
        <p className="apk-unavailable">构建接口不可用：请在电脑端项目目录执行 <code>npm run apk</code> 生成安装包。</p>
      )}

      {apk && !building && (
        <div className="apk-complete">
          打包完成 · 版本 {`v${apk.version || version}`} · {formatBuildTime(apk.mtime)}
        </div>
      )}

      {apk && (
        <div className="apk-result">
          <div className="apk-result-title">最新包</div>
          <div className="apk-meta">
            <span>{apk.file}</span>
            <span>{formatBytes(apk.size)}</span>
            <span>{formatBuildTime(apk.mtime)}</span>
          </div>
          <div className="apk-download-row">
            <a className="btn btn-small btn-primary" href={downloadUrl} download>
              <Icon name="download" size={14} />下载 APK
            </a>
            <button type="button" className="btn btn-small" onClick={copyLink}>
              复制下载链接
            </button>
          </div>
          {qrData && (
            <div className="apk-qr-wrap">
              <img className="apk-qr" src={qrData} alt="APK 下载二维码" />
              <span>手机扫码下载（需与电脑同局域网）</span>
            </div>
          )}
          <p className="apk-url">{downloadUrl}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="apk-history">
          <div className="apk-history-title">最近打包</div>
          {history.slice(0, 5).map((item, index) => (
            <a
              className="apk-history-item"
              key={`${item.version || item.file}-${index}`}
              href={historyUrl(item)}
              download>
              <span className="apk-history-version">{`v${item.version || '—'}`}</span>
              <span className="apk-history-file">{item.file}</span>
              <span className="apk-history-size">{formatBytes(item.size)}</span>
              <span className="apk-history-time">{formatBuildTime(item.mtime)}</span>
            </a>
          ))}
        </div>
      )}

      {logTail.length > 0 && (
        <details className="apk-log-wrap">
          <summary>构建日志（最近 {logTail.length} 行）</summary>
          <pre className="apk-log">{logTail.join('\n')}</pre>
        </details>
      )}

      <p className="apk-tip">
        一键打包在电脑端开发环境执行，自动使用当前源码与资源；手机版只负责安装运行。
      </p>
      {mobile && <MobileNotice forceMobile compact />}
    </div>
  );
}
