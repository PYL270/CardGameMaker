import React, { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import FontPicker from './FontPicker';
import ApkBuilder from './ApkBuilder';
import MobileNotice from './MobileNotice';
import Select from '../ui/Select';
import LayoutSettings from '../GameBoard/LayoutSettings';
import Icon from '../ui/Icon';
import { TEAM_MODE_OPTIONS, normalizeTeamMode } from '../GameBoard/teamConfig';
import {
  PRESETS,
  clampHandScale,
  loadLayout,
  saveLayout,
  updateLayout,
  applyPreset,
  defaultLayout,
} from '../GameBoard/layoutConfig';
import {
  UI_PREF_ITEMS,
  readUiPrefs,
  saveUiPrefs,
  applyUiPrefs,
} from '../../utils/uiPrefs';
import { alertDialog } from '../../utils/dialogService';
import { loadLLMConfig, saveLLMConfig } from '../../core/secureStore';

export default function Settings({ navigate }) {
  const [layout, setLayout] = useState(() => loadLayout());
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [uiPrefs, setUiPrefs] = useState(() => readUiPrefs());
  const updateUiPref = (key, value) => {
    const next = { ...uiPrefs, [key]: value };
    setUiPrefs(next);
    saveUiPrefs(next);
    applyUiPrefs(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cgm:ui-prefs', { detail: next }));
    }
  };

  const changeLayout = (patch) => {
    setLayout(prev => {
      const next = updateLayout(prev, patch);
      saveLayout(next);
      return next;
    });
  };
  const chooseLayoutPreset = (presetId) => {
    const next = applyPreset(presetId);
    setLayout(next);
    saveLayout(next);
  };
  const resetLayout = () => {
    const next = defaultLayout();
    setLayout(next);
    saveLayout(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cgm:reset-layout'));
    }
  };

  // LLM 配置改为异步加密存储：先渲染空配置，加载/解密完成后回填（apiKey 仅留在内存）
  const [llmConfig, setLlmConfig] = useState({});
  const llmConfigRef = useRef({});       // 最新配置快照，避免异步/闭包过期
  const llmTouchedRef = useRef(false);   // 加载完成前用户是否已开始编辑
  const llmSaveQueueRef = useRef(Promise.resolve()); // 串行保存，最后一次输入最终落盘

  useEffect(() => {
    let alive = true;
    loadLLMConfig()
      .then(cfg => {
        if (!alive) return;
        const loaded = cfg || {};
        if (!llmTouchedRef.current) {
          llmConfigRef.current = loaded;
          setLlmConfig(loaded);
          return;
        }
        // 加载完成前用户已输入：以已加载配置为底、用户输入优先，并补存一次避免丢其它字段
        const merged = { ...loaded, ...llmConfigRef.current };
        llmConfigRef.current = merged;
        setLlmConfig(merged);
        llmSaveQueueRef.current = llmSaveQueueRef.current
          .then(() => saveLLMConfig(merged))
          .catch(err => console.warn('[Settings] 保存 LLM 配置失败', err));
      })
      .catch(err => console.warn('[Settings] 读取 LLM 配置失败', err));
    return () => { alive = false; };
  }, []);

  const [gameConfig, setGameConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cgm_game_config') || '{}');
    } catch { return {}; }
  });

  const [effects, setEffects] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cgm_effects') || '{}');
    } catch { return {}; }
  });

  const saveEffect = (key, value) => {
    const next = { ...effects, [key]: value };
    setEffects(next);
    localStorage.setItem('cgm_effects', JSON.stringify(next));
  };

  const saveLlmConfig = (key, value) => {
    llmTouchedRef.current = true;
    const next = { ...llmConfigRef.current, [key]: value };
    llmConfigRef.current = next;
    setLlmConfig(next);
    // 异步加密保存（失败时内部降级为明文并 console.warn，不会抛未捕获异常）
    llmSaveQueueRef.current = llmSaveQueueRef.current
      .then(() => saveLLMConfig(next))
      .catch(err => console.warn('[Settings] 保存 LLM 配置失败', err));
  };

  const saveGameConfig = (key, value) => {
    const newConfig = { ...gameConfig, [key]: value };
    setGameConfig(newConfig);
    localStorage.setItem('cgm_game_config', JSON.stringify(newConfig));
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <button className="btn btn-small" onClick={() => navigate('menu')}>← 返回</button>
        <h2>设置</h2>
      </div>

      <div className="settings-content">
        <MobileNotice />
        <div className="panel settings-section">
          <h3>字体设置</h3>
          <FontPicker />
        </div>
        <div className="panel settings-section">
          <h3>游戏设置</h3>
          <div className="form-group">
            <label>默认玩家数</label>
            <Select value={gameConfig.playerCount || 2}
              onChange={e => saveGameConfig('playerCount', Number(e.target.value))}>
              {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}人</option>)}
            </Select>
          </div>
          <div className="form-group">
            <label>默认组队模式</label>
            <Select value={normalizeTeamMode(gameConfig.teamMode)}
              onChange={e => saveGameConfig('teamMode', e.target.value)}>
              {TEAM_MODE_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
            <p className="settings-tip">组队模式会在开局选将面板中作为默认值；2v2 固定 4 人、3v3 固定 6 人。</p>
          </div>
          <div className="form-group">
            <label className="switch-row">
              <span>默认允许误伤队友</span>
              <input type="checkbox" checked={gameConfig.friendlyFire === true}
                onChange={e => saveGameConfig('friendlyFire', e.target.checked)} />
            </label>
            <p className="settings-tip">仅组队模式生效；默认关闭，开启后玩家可把队友选为【杀】【决斗】【顺手牵羊】【过河拆桥】等单体牌目标（AI 仍不主动攻击队友）。</p>
          </div>
          <div className="form-group">
            <label className="switch-row">
              <span>可选触发技自动发动（不弹确认）</span>
              <input type="checkbox" checked={gameConfig.autoTrigger === true}
                onChange={e => saveGameConfig('autoTrigger', e.target.checked)} />
            </label>
            <p className="settings-tip">默认关闭；开启后真人满足【触发技】条件时自动发动，不再弹确认（锁定技始终自动生效；主动技不受影响）。</p>
          </div>
          <div className="form-group">
            <label>初始手牌数</label>
            <input type="number" min={1} max={10}
              value={gameConfig.initHandCards || 4}
              onChange={e => saveGameConfig('initHandCards', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>AI思考延迟(ms)</label>
            <input type="number" min={400} max={2000} step={100}
              value={gameConfig.aiDelay || 900}
              onChange={e => saveGameConfig('aiDelay', Number(e.target.value))} />
            <p className="settings-tip">默认 900ms；实际生效范围 700~1800ms（低于 700 自动按 700）。仅影响 AI 每步出牌节奏，不影响真人操作。</p>
          </div>
        </div>

        <div className="panel settings-section">
          <h3>界面布局</h3>
          <p className="settings-tip">
            对局内也可点顶栏「布局」随时调整；这里设置的是默认布局，进入对局即时生效。
          </p>
          <div className="form-group">
            <label>布局预设</label>
            <div className="layout-preset-row">
              {PRESETS.map(p => (
                <button key={p.id}
                  className={`btn btn-small ${layout.preset === p.id ? 'btn-primary' : ''}`}
                  title={p.desc}
                  onClick={() => chooseLayoutPreset(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>手牌缩放（{Math.round(layout.handScale * 100)}%）</label>
            <input type="range" min={0.85} max={1.3} step={0.05}
              value={layout.handScale}
              onChange={e => changeLayout({ handScale: clampHandScale(e.target.value) })} />
          </div>
          <div className="btn-row">
            <button className="btn btn-small" onClick={() => setShowLayoutPanel(true)}>
              打开完整布局设置
            </button>
            <button className="btn btn-small" onClick={resetLayout}>恢复默认布局</button>
          </div>
        </div>

        <div className="panel settings-section">
          <h3>界面增强</h3>
          <p className="settings-tip">
            只影响你自己的观感，不改动规则与联机数据；开关会立即保存，进入对局后生效。
          </p>
          <div className="ui-pref-list">
            {UI_PREF_ITEMS.map(item => (
              <label key={item.key} className="ui-pref-row">
                <span className="ui-pref-text">
                  <b>{item.label}</b>
                  <small>{item.hint}</small>
                </span>
                <input
                  type="checkbox"
                  checked={uiPrefs[item.key] !== false}
                  onChange={e => updateUiPref(item.key, e.target.checked)} />
              </label>
            ))}
          </div>
          <p className="settings-tip">默认开启角色卡强化与大字读数；桌面雕纹默认关闭，避免遮挡牌面。</p>
        </div>

        <div className="panel settings-section">
          <h3>AI代码生成设置</h3>
          <div className="form-group">
            <label>LLM API地址</label>
            <input type="text" placeholder="https://api.openai.com/v1/chat/completions"
              value={llmConfig.apiUrl || ''}
              onChange={e => saveLlmConfig('apiUrl', e.target.value)} />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input type="password" placeholder="sk-..."
              value={llmConfig.apiKey || ''}
              onChange={e => saveLlmConfig('apiKey', e.target.value)} />
          </div>
          <div className="form-group">
            <label>模型名称</label>
            <input type="text" placeholder="gpt-3.5-turbo"
              value={llmConfig.model || ''}
              onChange={e => saveLlmConfig('model', e.target.value)} />
          </div>
          <div className="form-group">
            <label>温度(创造性)</label>
            <input type="number" min={0} max={2} step={0.1}
              value={llmConfig.temperature || 0.7}
              onChange={e => saveLlmConfig('temperature', Number(e.target.value))} />
          </div>
        </div>

        <div className="panel settings-section">
          <h3>打击反馈</h3>
          <div className="form-group">
            <label className="switch-row">
              <span>震动反馈（移动端）</span>
              <input type="checkbox" checked={effects.vibrate !== false}
                onChange={e => saveEffect('vibrate', e.target.checked)} />
            </label>
          </div>
          <div className="form-group">
            <label className="switch-row">
              <span>打击音效</span>
              <input type="checkbox" checked={effects.sound !== false}
                onChange={e => saveEffect('sound', e.target.checked)} />
            </label>
          </div>
          <p className="settings-tip">开启后：受到伤害时屏幕震动、红光闪烁、伤害飘字，并触发设备震动与合成音效。</p>
        </div>

        <ApkBuilder />

        <div className="panel settings-section">
          <h3><Icon name="package" size={16} /><span>数据管理</span></h3>
          <div className="btn-row">
            <button className="btn btn-small" onClick={() => {
              const data = useGameStore.getState().exportToJSON();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'card_game_data.json'; a.click();
              URL.revokeObjectURL(url);
            }}>导出数据</button>
            <button className="btn btn-small" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = '.json';
              input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  try {
                    const data = JSON.parse(ev.target.result);
                    useGameStore.getState().loadFromJSON(data);
                    await alertDialog({ title: '导入完成', message: '导入成功！', kicker: 'DATA IMPORT' });
                  } catch {
                    await alertDialog({
                      title: '导入失败',
                      message: '导入失败：格式错误',
                      danger: true,
                      kicker: 'DATA IMPORT',
                    });
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}>导入数据</button>
          </div>
        </div>
      </div>

      {showLayoutPanel && (
        <LayoutSettings
          layout={layout}
          onChange={changeLayout}
          onPreset={chooseLayoutPreset}
          onReset={resetLayout}
          onClose={() => setShowLayoutPanel(false)}
        />
      )}

      <style>{`
        .settings-page { padding: 20px; overflow-y: auto; height: 100%; }
        .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .page-header h2 { color: var(--accent-gold); }
        .settings-content { display: flex; flex-direction: column; gap: 20px; max-width: 600px; }
        .settings-section h3 { color: var(--accent-gold); margin-bottom: 16px; }
        .btn-row { display: flex; gap: 10px; }
        .switch-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; font-size: 14px; color: var(--text-primary);
        }
        .switch-row input[type="checkbox"] {
          width: 20px; height: 20px; accent-color: var(--accent-gold);
          margin: 0; padding: 0;
        }
        .settings-tip { font-size: 11.5px; color: var(--text-secondary); opacity: 0.75; line-height: 1.5; }
        .layout-preset-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .settings-section input[type="range"] { width: 100%; accent-color: var(--accent-gold); }
      `}</style>
    </div>
  );
}
