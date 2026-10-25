import React, { useEffect, useState } from 'react';
import Icon from '../ui/Icon';
import { audio } from '../../audio/audioManager';

export const AI_DELAY_MIN = 700;
export const AI_DELAY_MAX = 1800;
export const AI_DELAY_DEFAULT = 900;

/** 读取 cgm_game_config.aiDelay（不破坏其它键；非法值回退 900） */
export function readGameAiDelay(storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return AI_DELAY_DEFAULT;
    const cfg = JSON.parse(store.getItem('cgm_game_config') || '{}');
    const n = Number(cfg?.aiDelay);
    if (!Number.isFinite(n)) return AI_DELAY_DEFAULT;
    return Math.min(AI_DELAY_MAX, Math.max(AI_DELAY_MIN, Math.round(n)));
  } catch {
    return AI_DELAY_DEFAULT;
  }
}

/** 写回 cgm_game_config.aiDelay，保留其它设置字段 */
export function saveGameAiDelay(value, storage) {
  const next = Math.min(AI_DELAY_MAX, Math.max(AI_DELAY_MIN, Math.round(Number(value) || AI_DELAY_DEFAULT)));
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return next;
    let cfg = {};
    try { cfg = JSON.parse(store.getItem('cgm_game_config') || '{}') || {}; } catch { cfg = {}; }
    store.setItem('cgm_game_config', JSON.stringify({ ...cfg, aiDelay: next }));
  } catch {
    // ignore
  }
  return next;
}

/**
 * 局内快捷设置：音效 / AI 节奏 / 显示开关。
 * 直接操作已有 audio manager、localStorage 与 GameBoard layout，不跳转完整设置页。
 */
export default function GameSettingsPanel({
  open = false,
  onClose,
  layout = {},
  onLayoutChange,
  onOpenLayout,
  audioManager = audio,
  spectator = false,
  roomCode = '',
  modeLabel = '',
  round = 0,
  phaseLabel = '',
}) {
  const [config, setConfig] = useState(() => audioManager?.getConfig?.() || { enabled: true, master: 0.8, bgm: 0.35, sfx: 0.7 });
  const [aiDelay, setAiDelay] = useState(() => readGameAiDelay());

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleAudio = (enabled) => {
    audioManager?.setEnabled?.(enabled);
    setConfig(audioManager?.getConfig?.() || config);
  };
  const setVolume = (key, percent) => {
    const value = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
    audioManager?.setVolume?.(key, value);
    setConfig(audioManager?.getConfig?.() || config);
  };
  const changeLayout = (key, checked) => {
    onLayoutChange?.({ [key]: checked });
  };
  const changeAiDelay = (value) => {
    const next = saveGameAiDelay(value);
    setAiDelay(next);
  };

  return (
    <div className="game-settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="game-settings-panel panel" role="dialog" aria-modal="true" aria-label="局内设置">
        <div className="game-settings-head">
          <h3><Icon name="settings" size={16} /><span>设置</span></h3>
          <button type="button" className="game-settings-close" onClick={onClose} aria-label="关闭设置">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="game-settings-body">
          <section className="game-settings-section">
            <div className="game-settings-title">音效</div>
            <label className="game-settings-switch">
              <span>启用游戏音频</span>
              <input
                type="checkbox"
                checked={config.enabled !== false}
                onChange={e => toggleAudio(e.target.checked)} />
            </label>
            {[
              ['master', '主音量'],
              ['bgm', '背景音乐'],
              ['sfx', '音效'],
            ].map(([key, label]) => (
              <label className="game-settings-slider" key={key}>
                <span>{label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round((Number(config[key]) || 0) * 100)}
                  onChange={e => setVolume(key, e.target.value)} />
                <b>{`${Math.round((Number(config[key]) || 0) * 100)}%`}</b>
              </label>
            ))}
            <p className="game-settings-note ok">音效设置已即时生效</p>
          </section>

          <section className="game-settings-section game-settings-match">
            <div className="game-settings-title">对局</div>
            <div className="game-settings-info">
              {roomCode && <span>房间 <b>{roomCode}</b></span>}
              {modeLabel && <span>模式 <b>{modeLabel}</b></span>}
              {round > 0 && <span>回合 <b>{round}</b></span>}
              {phaseLabel && <span>阶段 <b>{phaseLabel}</b></span>}
              {spectator && <span>身份 <b>观战</b></span>}
            </div>
            {!spectator && (
              <label className="game-settings-slider game-settings-ai">
                <span>AI 思考延迟</span>
                <input
                  type="range"
                  min={AI_DELAY_MIN}
                  max={AI_DELAY_MAX}
                  step="100"
                  value={aiDelay}
                  onChange={e => changeAiDelay(e.target.value)} />
                <b>{`${aiDelay}ms`}</b>
              </label>
            )}
            {!spectator && <p className="game-settings-note">仅影响 AI 后续行动节奏（700~1800ms）</p>}
          </section>

          <section className="game-settings-section">
            <div className="game-settings-title">显示</div>
            <label className="game-settings-switch">
              <span>伤害飘字 / 飞行牌</span>
              <input
                type="checkbox"
                checked={layout.showFloats !== false}
                onChange={e => changeLayout('showFloats', e.target.checked)} />
            </label>
            <label className="game-settings-switch">
              <span>距离提示</span>
              <input
                type="checkbox"
                checked={layout.showDistance !== false}
                onChange={e => changeLayout('showDistance', e.target.checked)} />
            </label>
            <label className="game-settings-switch">
              <span>回合开始横幅</span>
              <input
                type="checkbox"
                checked={layout.showBanner !== false}
                onChange={e => changeLayout('showBanner', e.target.checked)} />
            </label>
            <button
              type="button"
              className="btn btn-small game-settings-more"
              onClick={() => { onClose?.(); onOpenLayout?.(); }}>
              更多布局设置
            </button>
          </section>
        </div>

        <div className="game-settings-foot">
          <span>设置即时生效，不影响对局</span>
          <button type="button" className="btn btn-small" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
