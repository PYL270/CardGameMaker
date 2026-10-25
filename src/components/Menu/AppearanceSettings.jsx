import React, { useCallback, useEffect, useState } from 'react';
import { background, BG_PRESETS } from '../../appearance/backgroundManager';

/**
 * 背景设置：内置动态场景 + 自定义背景上传
 */
export default function AppearanceSettings({ onBack }) {
  const [config, setConfig] = useState(() => background.getConfig());
  const [imageUrl, setImageUrl] = useState(() => background.getImageUrl());
  const [fileInfo, setFileInfo] = useState(() => background.getFileInfo());

  useEffect(() => background.subscribe(() => {
    setConfig(background.getConfig());
    setImageUrl(background.getImageUrl());
    setFileInfo(background.getFileInfo());
  }), []);

  const upload = useCallback((file) => {
    if (file) background.importImage(file);
  }, []);

  return (
    <div className="bg-page">
      <div className="bg-shell panel">
        <div className="bg-head">
          <button className="btn btn-small" onClick={onBack}>← 返回</button>
          <h2>背景设置</h2>
          <span className="bg-head-hint">动态场景 / 自定义背景</span>
        </div>

        <section className="bg-section">
          <div className="bg-section-title">内置动态场景</div>
          <div className="bg-preset-grid">
            {BG_PRESETS.filter(p => p.id !== 'custom').map(p => (
              <button
                key={p.id}
                className={`bg-preset ${config.preset === p.id ? 'active' : ''}`}
                onClick={() => background.setPreset(p.id)}>
                <span
                  className={`bg-swatch preset-${p.id}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, ${p.colors[1]}, ${p.colors[0]} 70%)` }}>
                  <i style={{ background: p.colors[2] }} />
                </span>
                <strong>{p.name}</strong>
                <small>{p.desc}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-section">
          <div className="bg-section-title">自定义背景</div>
          <div className="bg-custom-row">
            <label className="btn btn-small bg-upload">
              上传图片
              <input type="file" accept="image/*" hidden
                onChange={e => {
                  upload(e.target.files?.[0]);
                  e.target.value = '';
                }} />
            </label>
            {imageUrl ? (
              <>
                <button className="btn btn-small" onClick={() => background.setPreset('custom')}>
                  使用自定义
                </button>
                <button className="btn btn-small btn-danger" onClick={() => background.removeImage()}>
                  删除图片
                </button>
              </>
            ) : (
              <span className="bg-note">支持 jpg / png / webp，单文件≤20MB，保存在本机浏览器</span>
            )}
          </div>
          {fileInfo && (
            <div className="bg-file">
              当前图片：{fileInfo.name}
              {imageUrl && <img className="bg-thumb" src={imageUrl} alt="自定义背景预览" />}
            </div>
          )}
        </section>

        <section className="bg-section">
          <div className="bg-section-title">显示效果</div>
          <div className="bg-sliders">
            <label className="bg-slider-row">
              <span>暗化</span>
              <input type="range" min="0" max="0.9" step="0.05" value={config.dim}
                onChange={e => background.setDim(Number(e.target.value))} />
              <span className="bg-slider-val">{Math.round(config.dim * 100)}%</span>
            </label>
            <label className="bg-slider-row">
              <span>模糊</span>
              <input type="range" min="0" max="16" step="1" value={config.blur}
                onChange={e => background.setBlur(Number(e.target.value))} />
              <span className="bg-slider-val">{config.blur}px</span>
            </label>
          </div>
          <label className="bg-switch">
            <input type="checkbox" checked={config.motion}
              onChange={e => background.setMotion(e.target.checked)} />
            <span>启用动态效果（流云 / 粒子 / 缓慢推移）</span>
          </label>
        </section>

        <p className="bg-tip">
          背景图保存在本机浏览器（IndexedDB），不会上传服务器；清除浏览器数据会删除。
          自定义背景与暗化/模糊设置会立即应用到对战与主菜单，并自动保存。
        </p>
      </div>

      <style>{`
        .bg-page {
          width: 100%; height: 100%; overflow-y: auto;
          padding: 22px; display: flex; justify-content: center;
        }
        .bg-shell { width: min(880px, 100%); height: fit-content; padding: 22px 24px 24px; }
        .bg-head {
          display: flex; align-items: center; gap: 12px;
          padding-bottom: 14px; margin-bottom: 16px;
          border-bottom: 1px solid rgba(214, 185, 110, 0.18);
          flex-wrap: wrap;
        }
        .bg-head h2 { font-size: 22px; color: var(--gold-bright); letter-spacing: 2px; margin-left: 4px; }
        .bg-head-hint { color: var(--text-secondary); font-size: 12px; margin-left: auto; }
        .bg-section { margin-bottom: 22px; }
        .bg-section-title {
          font-family: var(--font-serif); color: var(--gold);
          font-size: 15px; letter-spacing: 1px; margin-bottom: 10px;
        }
        .bg-preset-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
        }
        .bg-preset {
          display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
          padding: 10px; border-radius: 12px; cursor: pointer; text-align: left;
          background: linear-gradient(160deg, rgba(30, 33, 40, 0.86), rgba(10, 12, 17, 0.9));
          border: 1px solid rgba(214, 185, 110, 0.18);
          color: var(--text-primary);
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .bg-preset:hover { transform: translateY(-2px); border-color: rgba(214, 185, 110, 0.5); }
        .bg-preset.active {
          border-color: var(--gold);
          box-shadow: 0 0 0 1px rgba(214, 185, 110, 0.4), 0 10px 24px rgba(0, 0, 0, 0.35);
        }
        .bg-swatch {
          width: 100%; height: 64px; border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          position: relative; overflow: hidden; display: block;
        }
        .bg-swatch i {
          position: absolute; width: 60%; height: 60%; border-radius: 50%;
          right: -10%; bottom: -20%; filter: blur(18px); opacity: .55;
        }
        .bg-preset strong { font-size: 13.5px; margin-top: 2px; }
        .bg-preset small { font-size: 10.5px; color: var(--text-secondary); line-height: 1.45; }
        .bg-custom-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .bg-upload { cursor: pointer; }
        .bg-note { font-size: 11.5px; color: var(--text-secondary); }
        .bg-file { margin-top: 8px; font-size: 11.5px; color: var(--text-secondary); display: flex; align-items: center; gap: 10px; }
        .bg-thumb {
          width: 54px; height: 34px; object-fit: cover; border-radius: 4px;
          border: 1px solid rgba(214, 185, 110, 0.3);
        }
        .bg-sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 20px; margin-bottom: 12px; }
        .bg-slider-row { display: grid; grid-template-columns: 52px 1fr 46px; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
        .bg-slider-row input[type=range] { width: 100%; accent-color: #c9a94f; }
        .bg-slider-val { text-align: right; color: var(--gold-bright); font-variant-numeric: tabular-nums; }
        .bg-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); }
        .bg-switch input { width: 16px; height: 16px; accent-color: #c9a94f; }
        .bg-tip { font-size: 11.5px; color: var(--text-secondary); line-height: 1.7; opacity: .85; }
        @media (max-width: 720px) {
          .bg-page { padding: 10px; }
          .bg-shell { padding: 14px 12px 16px; }
          .bg-head h2 { font-size: 18px; }
          .bg-head-hint { display: none; }
          .bg-preset-grid { grid-template-columns: 1fr 1fr; }
          .bg-preset small { display: none; }
          .bg-swatch { height: 48px; }
        }
      `}</style>
    </div>
  );
}
