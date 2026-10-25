import React, { useCallback, useEffect, useState } from 'react';
import { audio, BGM_SLOTS, SFX_CATEGORIES, SFX_SLOTS, BUILTIN_BGM_OPTIONS } from '../../audio/audioManager';
import Select from '../ui/Select';

/**
 * 音频设置：背景音乐 / 音效 / 自定义上传
 * 自定义音频保存在浏览器 IndexedDB，不会上传服务器。
 */
export default function AudioSettings({ onBack }) {
  const [config, setConfig] = useState(() => audio.getConfig());
  const [files, setFiles] = useState(() => audio.getFiles());

  useEffect(() => {
    const unsubscribe = audio.subscribe(() => {
      setConfig(audio.getConfig());
      setFiles(audio.getFiles());
    });
    return unsubscribe;
  }, []);

  const upload = useCallback((slotKey, file) => {
    if (!file) return;
    audio.importFile(slotKey, file);
  }, []);

  const bgmModeLabel = (mode) => {
    if (mode === 'off') return '关闭';
    if (mode === 'custom') return '自定义';
    if (mode === 'synth:battle') return '内置 · 战鼓';
    if (mode === 'synth:calm') return '内置 · 山河';
    const found = BUILTIN_BGM_OPTIONS.find(o => o.mode === mode);
    return found ? `内置 · ${found.label}` : '内置 · 山河';
  };

  return (
    <div className="audio-page">
      <div className="audio-shell panel">
        <div className="audio-head">
          <button className="btn btn-small" onClick={onBack}>← 返回</button>
          <h2>音频设置</h2>
          <span className="audio-head-hint">音乐 / 音效 / 自定义音频</span>
        </div>

        <div className="audio-left">
        <section className="audio-section audio-common">
          <div className="audio-section-title">总控</div>
          <div className="audio-row">
            <label className="audio-switch">
              <input type="checkbox" checked={config.enabled}
                onChange={e => audio.setEnabled(e.target.checked)} />
              <span>启用游戏音频</span>
            </label>
            <span className="audio-note">关闭后背景音乐与音效全部静音</span>
          </div>

          <div className="audio-sliders">
            <VolumeRow label="主音量" value={config.master} onChange={v => audio.setVolume('master', v)} />
            <VolumeRow label="背景音乐" value={config.bgm} onChange={v => audio.setVolume('bgm', v)} />
            <VolumeRow label="音效" value={config.sfx} onChange={v => audio.setVolume('sfx', v)} />
          </div>
        </section>

        <section className="audio-section audio-bgm">
          <div className="audio-section-title">背景音乐</div>
          {BGM_SLOTS.map(slot => {
            const mode = config.slots[slot.key] || 'off';
            const file = files[slot.key];
            return (
              <div className="audio-slot" key={slot.key}>
                <div className="audio-slot-head">
                  <strong>{slot.label}</strong>
                  <span className="audio-slot-state">{bgmModeLabel(mode)}</span>
                </div>
                <div className="audio-slot-controls">
                  <Select className="audio-select" value={mode}
                    onChange={e => audio.setSlotMode(slot.key, e.target.value)}>
                    <option value="off">关闭</option>
                    {BUILTIN_BGM_OPTIONS.map(o => (
                      <option key={o.mode} value={o.mode}>内置 · {o.label}（{o.desc}）</option>
                    ))}
                    <option value="custom" disabled={!file}>自定义上传</option>
                  </Select>
                  <label className="btn btn-small audio-upload">
                    上传音频
                    <input type="file" accept="audio/*" hidden
                      onChange={e => {
                        upload(slot.key, e.target.files?.[0]);
                        e.target.value = '';
                      }} />
                  </label>
                  {file && mode === 'custom' && (
                    <>
                      <button className="btn btn-small" onClick={() => audio.previewBgm(slot.key)}>试听</button>
                      <button className="btn btn-small btn-danger" onClick={() => audio.removeFile(slot.key)}>删除</button>
                    </>
                  )}
                </div>
                <div className="audio-file">{file ? `本地文件：${file.name}` : '当前未上传自定义文件'}</div>
              </div>
            );
          })}
        </section>
        </div>

        <section className="audio-section audio-sfx">
          <div className="audio-section-title">音效</div>
          {SFX_CATEGORIES.map(category => {
            const categorySlots = SFX_SLOTS.filter(slot => slot.category === category.id);
            return (
              <div className="audio-sfx-group" key={category.id}>
                <div className="audio-sfx-group-head">
                  <div>
                    <strong>{category.label}</strong>
                    <span className="audio-sfx-group-desc">{category.desc} · {categorySlots.length} 项</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      categorySlots.forEach((slot, index) => {
                        setTimeout(() => audio.previewSfx(slot.key.replace('sfx:', '')), index * 460);
                      });
                    }}>
                    本类全部试听
                  </button>
                </div>
                <div className="audio-sfx-grid">
                  {categorySlots.map(slot => {
                    const file = files[slot.key];
                    const isCustom = config.slots[slot.key] === 'custom' && !!file;
                    return (
                      <div className="audio-sfx-card" key={slot.key}>
                        <div className="audio-sfx-head">
                          <strong>{slot.label}</strong>
                          <span className={`audio-dot ${isCustom ? 'custom' : ''}`} />
                        </div>
                        <div className="audio-file">
                          {isCustom ? file.name : (slot.sample ? '内置 CC0 采样' : '内置合成音效')}
                        </div>
                        <div className="audio-sfx-actions">
                          <button className="btn btn-small" onClick={() => audio.previewSfx(slot.key.replace('sfx:', ''))}>
                            试听
                          </button>
                          <label className="btn btn-small audio-upload">
                            替换
                            <input type="file" accept="audio/*" hidden
                              onChange={e => {
                                upload(slot.key, e.target.files?.[0]);
                                e.target.value = '';
                              }} />
                          </label>
                          {isCustom && (
                            <button className="btn btn-small btn-danger"
                              onClick={() => audio.removeFile(slot.key)}>还原</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <p className="audio-tip">
          内置《山河》《战鼓》《沈阳》《涟漪》《古筝城》五首曲目；
          《沈阳》《涟漪》《古筝城》由 Kevin MacLeod 创作（incompetech.com），CC BY 4.0，保留署名即可免费使用；
          音效采样来自 Kenney（CC0）与项目原创合成（CC0），授权详情见 <code>public/audio/SFX_CREDITS.md</code>；
          MP3 会在解码后自动裁掉首尾静音并淡入淡出，降低循环接缝。自定义音频保存在本机浏览器（IndexedDB），不会上传服务器；
          清除浏览器数据会同时删除。支持 mp3 / wav / ogg / m4a，单文件建议不超过 40MB。
          首次点击页面后背景音乐才会开始播放（浏览器自动播放限制）。
        </p>
      </div>

      <style>{`
        .audio-page {
          width: 100%; height: 100%; overflow-y: auto;
          padding: 22px; display: flex; justify-content: center;
        }
        .audio-shell {
          width: min(860px, 100%);
          height: fit-content;
          padding: 22px 24px 24px;
        }
        .audio-head {
          display: flex; align-items: center; gap: 12px;
          padding-bottom: 14px; margin-bottom: 16px;
          border-bottom: 1px solid rgba(214, 185, 110, 0.18);
          flex-wrap: wrap;
        }
        .audio-head h2 {
          font-size: 22px; color: var(--gold-bright);
          letter-spacing: 2px; margin-left: 4px;
        }
        .audio-head-hint { color: var(--text-secondary); font-size: 12px; margin-left: auto; }
        .audio-section { margin-bottom: 22px; }
        .audio-section-title {
          font-family: var(--font-serif);
          color: var(--gold);
          font-size: 15px;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .audio-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
        .audio-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-primary); }
        .audio-switch input { width: 16px; height: 16px; accent-color: #c9a94f; }
        .audio-note { font-size: 12px; color: var(--text-secondary); }
        .audio-sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 18px; }
        .audio-slider-row { display: grid; grid-template-columns: 70px 1fr 44px; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
        .audio-slider-row input[type=range] { width: 100%; accent-color: #c9a94f; }
        .audio-slider-val { text-align: right; font-variant-numeric: tabular-nums; color: var(--gold-bright); }
        .audio-slot {
          background: linear-gradient(160deg, rgba(30, 33, 40, 0.86), rgba(10, 12, 17, 0.9));
          border: 1px solid rgba(214, 185, 110, 0.18);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .audio-slot-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .audio-slot-head strong { font-size: 14px; }
        .audio-slot-state { font-size: 11.5px; color: var(--gold); }
        .audio-slot-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .audio-select.ui-select {
          padding: 0; border: 0; background: transparent;
          width: auto; min-width: 210px;
        }
        .audio-select .ui-select-trigger {
          padding: 6px 10px; border-radius: 8px; font-size: 13px;
          background: rgba(7, 9, 13, 0.8);
          border: 1px solid rgba(214, 185, 110, 0.28);
          color: var(--text-primary);
        }
        .audio-upload { cursor: pointer; }
        .audio-file {
          margin-top: 8px; font-size: 11.5px; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .audio-sfx-group { margin-bottom: 14px; }
        .audio-sfx-group-head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          margin-bottom: 7px; flex-wrap: wrap;
        }
        .audio-sfx-group-head > div { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .audio-sfx-group-head strong {
          font-family: var(--font-serif); font-size: 13.5px; color: var(--gold-bright);
          letter-spacing: .06em; font-weight: 400;
        }
        .audio-sfx-group-desc { font-size: 10.5px; color: var(--text-secondary); opacity: .8; }
        .audio-sfx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
        .audio-sfx-card {
          background: linear-gradient(160deg, rgba(30, 33, 40, 0.82), rgba(10, 12, 17, 0.88));
          border: 1px solid rgba(214, 185, 110, 0.16);
          border-radius: 12px;
          padding: 12px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .audio-sfx-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .audio-sfx-head strong { font-size: 13.5px; }
        .audio-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
        .audio-dot.custom { background: var(--gold-bright); box-shadow: 0 0 8px rgba(240, 216, 148, 0.7); }
        .audio-sfx-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
        .audio-tip { font-size: 11.5px; color: var(--text-secondary); line-height: 1.7; opacity: 0.85; }
        @media (max-width: 720px) {
          .audio-page { padding: 10px; }
          .audio-shell { padding: 14px 12px 16px; }
          .audio-head h2 { font-size: 18px; }
          .audio-head-hint { display: none; }
          .audio-slider-row { grid-template-columns: 62px 1fr 40px; }
          .audio-sfx-grid { grid-template-columns: 1fr 1fr; }
          .audio-sfx-card { padding: 10px; }
        }
      `}</style>
    </div>
  );
}

function VolumeRow({ label, value, onChange }) {
  return (
    <label className="audio-slider-row">
      <span>{label}</span>
      <input type="range" min="0" max="1" step="0.05" value={value}
        onChange={e => onChange(Number(e.target.value))} />
      <span className="audio-slider-val">{Math.round(value * 100)}%</span>
    </label>
  );
}
