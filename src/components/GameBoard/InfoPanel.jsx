import React, { useEffect } from 'react';

/**
 * InfoPanel - 点击状态/技能/牌面后弹出的小说明面板
 * 位置跟随点击点并自动收进屏幕内；点击空白处 / Esc / × 均可关闭。
 * onOpenGuide 提供时，可从面板直接打开完整说明。
 */
export default function InfoPanel({ info, onClose, onOpenGuide }) {
  useEffect(() => {
    if (!info) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    // 点击空白处关闭；点击其他说明入口时不关闭，便于连续查看
    const onPointerDown = (e) => {
      const target = e.target;
      if (target?.closest?.('.info-panel')) return;
      if (target?.closest?.('[data-info-trigger]')) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [info, onClose]);

  if (!info) return null;
  const x = Math.max(10, Math.min(info.x ?? 40, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300));
  const y = Math.max(64, Math.min(info.y ?? 120, (typeof window !== 'undefined' ? window.innerHeight : 800) - 240));

  return (
    <div className="info-panel" style={{ left: x, top: y }} role="dialog">
      <div className="info-panel-head">
        <strong>{info.title}</strong>
        <button className="info-close" onClick={onClose} aria-label="关闭说明">×</button>
      </div>
      <div className="info-panel-body">{info.desc || '暂无说明'}</div>
      {onOpenGuide && (
        <div className="info-panel-foot">
          <button
            className="btn btn-small info-guide-link"
            onClick={() => { onOpenGuide?.(); onClose?.(); }}>
            查看完整说明
          </button>
        </div>
      )}
    </div>
  );
}
