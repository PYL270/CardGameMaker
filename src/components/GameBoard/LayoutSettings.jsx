import React from 'react';
import {
  PRESETS,
  THEME_OPTIONS,
  HAND_GAP_OPTIONS,
  OPPONENT_SCALE_OPTIONS,
  LOG_POSITION_OPTIONS,
  HAND_SCALE_MIN,
  HAND_SCALE_MAX,
  clampHandScale,
  normalizeLayout,
  themeOption,
} from './layoutConfig';

/**
 * LayoutSettings - 对局内布局设置面板（齿轮打开）
 * 纯展示组件：所有修改通过 onChange / onPreset / onReset 回传给 GameBoard，
 * 便于 UI 冒烟测试直接渲染并断言。
 */
export default function LayoutSettings({ layout: rawLayout, onChange, onPreset, onReset, onClose }) {
  const layout = normalizeLayout(rawLayout);
  const scalePct = Math.round(layout.handScale * 100);
  const currentPreset = PRESETS.find(p => p.id === layout.preset) || PRESETS[0];
  const currentTheme = themeOption(layout);

  return (
    <div className="layout-settings-overlay" onClick={onClose}>
      <div
        className="panel layout-settings"
        role="dialog"
        aria-label="布局设置"
        onClick={(e) => e.stopPropagation()}>
        <div className="layout-settings-head">
          <h3>布局设置</h3>
          <button className="btn btn-small" onClick={onClose}>关闭</button>
        </div>

        <div className="layout-row layout-theme-row">
          <span className="layout-label">界面风格</span>
          <div className="layout-options theme-options">
            {THEME_OPTIONS.map(t => (
              <button key={t.id}
                className={`theme-card ${layout.theme === t.id ? 'is-active' : ''}`}
                title={t.desc}
                aria-pressed={layout.theme === t.id}
                onClick={() => onChange?.({ theme: t.id })}>
                <span className="theme-swatch" aria-hidden="true">
                  {t.swatch.map(color => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="theme-card-text">
                  <b>{t.name}</b>
                  <small>{t.short}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="layout-desc">{currentTheme.desc}</p>

        <div className="layout-row">
          <span className="layout-label">布局预设</span>
          <div className="layout-options">
            {PRESETS.map(p => (
              <button key={p.id}
                className={`btn btn-small ${layout.preset === p.id ? 'btn-primary' : ''}`}
                title={p.desc}
                onClick={() => onPreset?.(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <p className="layout-desc">{currentPreset.desc}</p>

        <div className="layout-row">
          <span className="layout-label">手牌缩放</span>
          <input className="layout-range" type="range"
            min={HAND_SCALE_MIN} max={HAND_SCALE_MAX} step="0.05"
            value={layout.handScale}
            aria-label="手牌缩放"
            onChange={(e) => onChange?.({ handScale: clampHandScale(e.target.value) })} />
          <span className="layout-value">{`${scalePct}%`}</span>
        </div>

        <div className="layout-row">
          <span className="layout-label">手牌间距/重叠</span>
          <div className="layout-options">
            {HAND_GAP_OPTIONS.map(o => (
              <button key={o.id}
                className={`btn btn-small ${layout.handGap === o.id ? 'btn-primary' : ''}`}
                onClick={() => onChange?.({ handGap: o.id })}>
                {o.name}
              </button>
            ))}
          </div>
        </div>

        <div className="layout-row">
          <span className="layout-label">对手卡尺寸</span>
          <div className="layout-options">
            {OPPONENT_SCALE_OPTIONS.map(o => (
              <button key={o.id}
                className={`btn btn-small ${layout.opponentScale === o.id ? 'btn-primary' : ''}`}
                onClick={() => onChange?.({ opponentScale: o.id })}>
                {o.name}
              </button>
            ))}
          </div>
        </div>

        <div className="layout-row">
          <span className="layout-label">日志位置</span>
          <div className="layout-options">
            {LOG_POSITION_OPTIONS.map(o => (
              <button key={o.id}
                className={`btn btn-small ${layout.logPosition === o.id ? 'btn-primary' : ''}`}
                onClick={() => onChange?.({ logPosition: o.id })}>
                {o.name}
              </button>
            ))}
          </div>
        </div>

        <div className="layout-row layout-toggles">
          <label className="layout-check">
            <input type="checkbox" checked={layout.showBanner}
              onChange={(e) => onChange?.({ showBanner: e.target.checked })} />
            回合横幅
          </label>
          <label className="layout-check">
            <input type="checkbox" checked={layout.showFloats}
              onChange={(e) => onChange?.({ showFloats: e.target.checked })} />
            飘字/飞牌提示
          </label>
          <label className="layout-check">
            <input type="checkbox" checked={layout.showDistance}
              onChange={(e) => onChange?.({ showDistance: e.target.checked })} />
            显示距离提示
          </label>
          <label className="layout-check">
            <input type="checkbox" checked={layout.logCollapsed}
              onChange={(e) => onChange?.({ logCollapsed: e.target.checked })} />
            日志默认收起
          </label>
        </div>

        <div className="layout-foot">
          <button className="btn" onClick={() => onReset?.()}>恢复默认布局</button>
        </div>

        <p className="layout-tip">设置会保存到本机，刷新后仍生效；对局中修改立即预览。</p>

        <style>{`
          .layout-settings-overlay {
            position: fixed; inset: 0; z-index: 1200;
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
            background: rgba(4, 6, 10, 0.6);
            -webkit-backdrop-filter: blur(3px);
            backdrop-filter: blur(3px);
          }
          .layout-settings {
            width: min(560px, 94vw);
            max-height: 86vh; overflow-y: auto;
            padding: 16px 18px;
            cursor: default;
            touch-action: pan-y;
          }
          .layout-settings-head {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; margin-bottom: 10px;
          }
          .layout-settings-head h3 { color: var(--accent-gold); font-size: 18px; }
          .layout-row {
            display: flex; align-items: center; gap: 10px;
            padding: 7px 0; border-top: 1px solid rgba(214, 185, 110, 0.12);
            flex-wrap: wrap;
          }
          .layout-label { width: 84px; flex-shrink: 0; font-size: 13px; color: var(--text-secondary); }
          .layout-options { display: flex; gap: 6px; flex-wrap: wrap; }
          .layout-options .btn-small { min-height: 30px; padding: 4px 12px; font-size: 12.5px; }
          .layout-theme-row { align-items: flex-start; }
          .theme-options { gap: 8px; }
          .theme-card {
            display: flex; align-items: center; gap: 8px;
            min-height: 42px; padding: 6px 10px 6px 7px;
            border: 1px solid rgba(214, 185, 110, 0.22);
            border-radius: 11px;
            background: rgba(14, 17, 23, 0.72);
            color: var(--text-primary);
            cursor: pointer;
            transition: border-color .18s ease, background .18s ease, transform .18s ease;
          }
          .theme-card:hover { border-color: rgba(214, 185, 110, 0.52); transform: translateY(-1px); }
          .theme-card.is-active {
            border-color: rgba(240, 216, 148, 0.8);
            background: rgba(214, 185, 110, 0.12);
            box-shadow: inset 0 0 0 1px rgba(240, 216, 148, 0.16);
          }
          .theme-swatch {
            display: flex; flex-direction: column; gap: 2px;
            width: 22px; height: 28px; padding: 2px;
            border-radius: 6px; overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #080a0e;
          }
          .theme-swatch i { flex: 1; border-radius: 2px; }
          .theme-card-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
          .theme-card-text b { font-size: 12.5px; font-weight: 700; white-space: nowrap; }
          .theme-card-text small { margin-top: 2px; font-size: 10px; color: var(--text-secondary); }
          .layout-range { flex: 1; min-width: 120px; accent-color: var(--accent-gold); }
          .layout-value { width: 46px; text-align: right; font-size: 12.5px; color: var(--gold-bright); font-variant-numeric: tabular-nums; }
          .layout-desc { font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 4px; }
          .layout-toggles { gap: 16px; }
          .layout-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-primary); cursor: pointer; }
          .layout-check input { accent-color: var(--accent-gold); }
          .layout-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }
          .layout-tip { font-size: 11px; color: var(--text-secondary); margin-top: 8px; }
          @media (max-width: 720px) {
            .layout-settings { width: 96vw; max-height: 92vh; padding: 12px 14px; }
            .layout-label { width: 100%; }
            .layout-options { flex: 1 1 100%; }
            .theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
            .theme-card { min-width: 0; padding: 6px 5px; gap: 5px; }
            .theme-card-text b { font-size: 11px; white-space: normal; }
            .theme-card-text small { display: none; }
            .theme-swatch { width: 18px; height: 24px; }
          }
        `}</style>
      </div>
    </div>
  );
}
