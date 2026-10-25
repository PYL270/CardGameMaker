import React, { useState } from 'react';
import { FONT_PRESETS, loadFontConfig, saveFontConfig } from '../../appearance/fontManager';

/**
 * 字体选择器：点击即预览并保存，标题/正文/牌名同步生效。
 * 放在「设置 → 字体设置」中，不改动对局数据。
 */
export default function FontPicker() {
  const [config, setConfig] = useState(() => loadFontConfig());

  const choose = (id) => {
    const next = { ...config, preset: id };
    setConfig(next);
    saveFontConfig(next);
  };

  return (
    <div className="font-picker">
      <div className="font-grid">
        {FONT_PRESETS.map(p => (
          <button
            key={p.id}
            className={`font-option ${config.preset === p.id ? 'active' : ''}`}
            onClick={() => choose(p.id)}
            title={p.desc}
          >
            <span className="font-sample" style={{ fontFamily: p.titleFont }}>{p.sample}</span>
            <span className="font-meta">
              <strong>{p.name}</strong>
              <em>{p.desc}</em>
            </span>
          </button>
        ))}
      </div>
      <p className="font-tip">字体仅影响界面标题与正文；卡牌点数、花色保持原有辨识度。所有字体离线可用，不联网下载。</p>
      <style>{`
        .font-picker { display: flex; flex-direction: column; gap: 12px; }
        .font-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .font-option {
          display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
          padding: 12px 14px; border-radius: 12px; cursor: pointer; text-align: left;
          background: rgba(12, 15, 22, 0.55);
          border: 1px solid rgba(214, 185, 110, 0.18);
          color: var(--text-secondary);
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .font-option:hover { transform: translateY(-2px); border-color: rgba(214, 185, 110, 0.5); }
        .font-option.active {
          border-color: var(--gold);
          box-shadow: 0 0 0 1px rgba(214, 185, 110, 0.18), 0 8px 24px rgba(0, 0, 0, 0.28);
          background: rgba(214, 185, 110, 0.07);
        }
        .font-sample {
          font-size: 24px; line-height: 1.25; color: var(--gold-bright);
          letter-spacing: 1px; white-space: nowrap;
        }
        .font-meta { display: flex; flex-direction: column; gap: 2px; }
        .font-meta strong { font-size: 13px; color: var(--text-primary); font-weight: 600; }
        .font-meta em { font-style: normal; font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
        .font-tip { font-size: 11.5px; line-height: 1.6; color: var(--text-secondary); opacity: .8; margin: 0; }
      `}</style>
    </div>
  );
}
