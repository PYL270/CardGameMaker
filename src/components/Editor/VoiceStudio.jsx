import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';
import Select from '../ui/Select';
import {
  DEFAULT_PIPER_API_BASE,
  DEFAULT_VOICE_REF,
  VOICE_PROVIDERS,
  VOICE_TEXT_LIMIT,
  buildDefaultVoiceText,
  checkPiperHealth,
  generateGptSpeech,
  generatePiperSpeech,
  isSpeechSupported,
  listBrowserVoices,
  pickChineseVoice,
  readVoiceConfig,
  revokeVoiceUrl,
  saveVoiceConfig,
  speakText,
  speechErrorMessage,
  stopSpeech,
  waitForBrowserVoices,
} from '../../ai/voiceTTS';

/**
 * AI 配音面板：浏览器内置语音（免费）/ GPT-SoVITS（本地克隆）/ Piper（离线 CPU）。
 * 参考音频路径与文本只发给本机 API，不上传。
 */
export default function VoiceStudio({ name = '', skillNames = [] }) {
  const [config, setConfig] = useState(() => readVoiceConfig());
  const [text, setText] = useState(() => buildDefaultVoiceText(name, skillNames));
  const [textTouched, setTextTouched] = useState(false);
  const [voices, setVoices] = useState(() => listBrowserVoices());
  const [voicesReady, setVoicesReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [piperHealth, setPiperHealth] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');

  useEffect(() => {
    if (!textTouched) setText(buildDefaultVoiceText(name, skillNames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, skillNames.join('|')]);

  useEffect(() => {
    saveVoiceConfig(config);
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      const list = listBrowserVoices();
      if (!cancelled) setVoices(list);
      return list;
    };
    refresh();
    waitForBrowserVoices(2000).then(list => {
      if (cancelled) return;
      setVoices(list);
      setVoicesReady(true);
    });
    if (!isSpeechSupported()) return () => { cancelled = true; };
    const synth = window.speechSynthesis;
    const onChange = () => refresh();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', onChange);
    return () => {
      cancelled = true;
      if (typeof synth.removeEventListener === 'function') synth.removeEventListener('voiceschanged', onChange);
    };
  }, []);

  useEffect(() => {
    if (config.provider !== 'piper') {
      setPiperHealth(null);
      return undefined;
    }
    let cancelled = false;
    checkPiperHealth({ apiBase: config.piperApiBase }).then(health => {
      if (!cancelled) setPiperHealth(health.ok);
    });
    return () => { cancelled = true; };
  }, [config.provider, config.piperApiBase]);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [audioUrl]);

  useEffect(() => () => {
    stopSpeech();
    revokeVoiceUrl(audioUrlRef.current);
  }, []);

  const patchConfig = (patch) => setConfig(prev => ({ ...prev, ...patch }));

  const setNewAudioUrl = (url) => {
    setAudioUrl(prev => {
      if (prev && prev !== url) revokeVoiceUrl(prev);
      return url;
    });
  };

  const handlePreview = async () => {
    const clean = text.trim();
    if (!clean) { setError('请先填写试听文本'); return; }
    setError('');
    setLoading(true);
    try {
      if (config.provider === 'browser') {
        if (!isSpeechSupported()) {
          setError('当前浏览器不支持内置语音：请改用本地 Piper / GPT-SoVITS，或使用支持语音的浏览器。');
          return;
        }
        let list = voices;
        if (list.length === 0) {
          setStatus('正在等待系统语音加载…');
          list = await waitForBrowserVoices(2000);
          setVoices(list);
          setVoicesReady(true);
        }
        const voice = list.find(v => v.voiceURI === config.browserVoice || v.name === config.browserVoice)
          || pickChineseVoice(list);
        const result = await speakText(clean, {
          voice,
          rate: config.rate,
          pitch: config.pitch,
          onEnd: () => setStatus('浏览器语音播放完成'),
          onError: (message) => setError(message || speechErrorMessage()),
        });
        if (!result.ok) { setError(result.error); return; }
        if (!voice) {
          setStatus('系统语音 0 个，已尝试默认发音；若无声请安装中文语音或改用本地 Piper/GPT。');
        } else {
          setStatus('浏览器语音播放中…');
        }
      } else if (config.provider === 'piper') {
        setStatus('正在生成 Piper 离线语音（首次加载稍慢）…');
        const result = await generatePiperSpeech({
          text: clean,
          apiBase: config.piperApiBase,
        });
        if (!result.ok) { setError(result.error); setStatus(''); return; }
        setNewAudioUrl(result.audioUrl);
        setStatus('已生成，正在播放试听…');
      } else {
        setStatus('正在请求本地 GPT-SoVITS（首次加载模型可能较慢）…');
        const result = await generateGptSpeech({
          text: clean,
          refAudioPath: config.refAudioPath,
          promptText: config.promptText,
          speed: config.speed,
          apiBase: config.apiBase,
        });
        if (!result.ok) { setError(result.error); setStatus(''); return; }
        setNewAudioUrl(result.audioUrl);
        setStatus('生成成功，正在播放试听…');
      }
    } catch (e) {
      setError(`配音失败：${e?.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    stopSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus('已停止');
  };

  const handleCheckPiper = async () => {
    setChecking(true);
    setError('');
    setStatus('正在检测 Piper 服务…');
    const health = await checkPiperHealth({ apiBase: config.piperApiBase });
    setPiperHealth(health.ok);
    if (health.ok) {
      setStatus('Piper 服务在线，可以离线合成');
    } else {
      setStatus('');
      setError(health.error);
    }
    setChecking(false);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${(name || 'voice').replace(/[\\/:*?"<>|\s]+/g, '-')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startVoiceHint = (
    <span className="voice-hint-inline">
      需先在根目录双击 <code>start-voice.bat</code> 启动本地服务（127.0.0.1:9880）。
    </span>
  );
  const startPiperHint = (
    <span className="voice-hint-inline">
      需先在根目录双击 <code>start-piper.bat</code> 启动离线服务（127.0.0.1:9881）。
    </span>
  );

  return (
    <div className="voice-studio">
      <div className="voice-head">
        <h4><Icon name="mic" size={15} /> AI 配音</h4>
        <span>本地试听 · 不上传</span>
      </div>
      <p className="voice-lead">
        <Icon name="mic" size={15} /> 给武将录一句登场语音：浏览器语音免费即用；GPT-SoVITS 用参考音频克隆音色；Piper 离线免费、无需参考音频。
      </p>
      <p className="voice-cross-player">
        浏览器语音所有玩家可用；Piper / GPT-SoVITS 仅已启动本机服务的设备可用，其他玩家可直接用浏览器语音，或各自启动本地服务。
      </p>

      {config.provider !== 'browser' && (
        <div className={`voice-service-warning ${piperHealth === false || config.provider === 'piper' ? 'offline' : ''}`}>
          <Icon name="alert" size={14} />
          <span>
            本地服务仅本机可用。
            {config.provider === 'piper'
              ? (piperHealth === false ? ' Piper 未连接：请双击 start-piper.bat 启动。' : ' 若未启动请双击 start-piper.bat。')
              : ' 若未启动请双击 start-voice.bat。'}
          </span>
          <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'browser' })}>
            改用浏览器语音
          </button>
        </div>
      )}

      {(!isSpeechSupported() || voices.length === 0) && (
        <div className="voice-warning">
          <Icon name="alert" size={14} />
          <span>
            系统未安装中文语音或尚未加载（系统语音 {voices.length} 个）。仍会尝试默认发音；若无声请到
            Windows 设置 → 时间和语言 → 语音 → 添加中文语音，或改用本地 Piper / GPT-SoVITS。
          </span>
          <div className="voice-warning-actions">
            <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'piper' })}>改用本地 Piper</button>
            <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'gpt-sovits' })}>改用本地 GPT-SoVITS</button>
          </div>
        </div>
      )}

      <div className="voice-field">
        <label htmlFor="voice-provider">语音引擎 <em>{config.provider === 'piper' ? '离线 CPU · 无需参考音频' : config.provider === 'gpt-sovits' ? '本地克隆' : '免费内置'}</em></label>
        <Select id="voice-provider" value={config.provider}
          onChange={e => { patchConfig({ provider: e.target.value }); setStatus(''); setError(''); setPiperHealth(null); }}>
          {VOICE_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        <div className="voice-provider-legend">
          <span className={config.provider === 'browser' ? 'active' : ''}>浏览器 · 免费内置</span>
          <span className={config.provider === 'gpt-sovits' ? 'active' : ''}>GPT-SoVITS · 本地克隆</span>
          <span className={config.provider === 'piper' ? 'active' : ''}>Piper · 离线免费 · 无需参考音频</span>
        </div>
        <p className="voice-hint">本地引擎：GPT-SoVITS 需 start-voice.bat；Piper 需 start-piper.bat（均在根目录）。</p>
      </div>

      <div className="voice-field">
        <label htmlFor="voice-text">试听文本 <em>{text.length} / {VOICE_TEXT_LIMIT}</em></label>
        <textarea id="voice-text" rows={3} maxLength={VOICE_TEXT_LIMIT} value={text}
          placeholder="如：关羽，参战！"
          onChange={e => { setText(e.target.value); setTextTouched(true); }} />
        <p className="voice-hint">默认按武将名与已选技能生成；可自由改写，最多 {VOICE_TEXT_LIMIT} 字。</p>
      </div>

      {config.provider === 'browser' ? (
        <>
          <div className="voice-grid">
            <div className="voice-field">
              <label htmlFor="voice-browser-voice">系统语音 <em>{`系统语音 ${voices.length} 个${voicesReady ? '' : '…'}`}</em></label>
              <Select id="voice-browser-voice" value={config.browserVoice}
                onChange={e => patchConfig({ browserVoice: e.target.value })}>
                <option value="">自动选择中文语音</option>
                {voices.map(v => (
                  <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                    {v.name}{v.lang ? ` (${v.lang})` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div className="voice-field">
              <label htmlFor="voice-rate">语速 <em>{config.rate.toFixed(1)}x</em></label>
              <input id="voice-rate" type="range" min="0.5" max="2" step="0.1" value={config.rate}
                onChange={e => patchConfig({ rate: Number(e.target.value) })} />
            </div>
            <div className="voice-field">
              <label htmlFor="voice-pitch">音调 <em>{config.pitch.toFixed(1)}</em></label>
              <input id="voice-pitch" type="range" min="0.5" max="1.8" step="0.1" value={config.pitch}
                onChange={e => patchConfig({ pitch: Number(e.target.value) })} />
            </div>
          </div>
          {!isSpeechSupported() && (
            <p className="voice-hint">当前环境无 speechSynthesis；若在浏览器中仍无声音，请按上方提示安装中文语音或切换本地引擎。</p>
          )}
        </>
      ) : config.provider === 'gpt-sovits' ? (
        <>
          <div className="voice-grid">
            <div className="voice-field">
              <label htmlFor="voice-api">API 地址</label>
              <input id="voice-api" type="text" value={config.apiBase}
                onChange={e => patchConfig({ apiBase: e.target.value })} />
            </div>
            <div className="voice-field">
              <label htmlFor="voice-speed">语速 <em>{config.speed.toFixed(1)}x</em></label>
              <input id="voice-speed" type="range" min="0.5" max="2" step="0.1" value={config.speed}
                onChange={e => patchConfig({ speed: Number(e.target.value) })} />
            </div>
          </div>
          <div className="voice-field">
            <label htmlFor="voice-ref">参考音频路径 <em>本机绝对路径 · wav</em></label>
            <input id="voice-ref" type="text" value={config.refAudioPath}
              placeholder={DEFAULT_VOICE_REF}
              onChange={e => patchConfig({ refAudioPath: e.target.value })} />
            <p className="voice-hint">示例：{DEFAULT_VOICE_REF}（由队友生成到 voice_refs 目录；换音色就换参考 wav）。</p>
          </div>
          <div className="voice-field">
            <label htmlFor="voice-prompt">参考音频对应文本</label>
            <textarea id="voice-prompt" rows={2} maxLength={120} value={config.promptText}
              onChange={e => patchConfig({ promptText: e.target.value })} />
          </div>
          <p className="voice-hint">{startVoiceHint}</p>
        </>
      ) : (
        <>
          <div className="voice-grid">
            <div className="voice-field">
              <label htmlFor="piper-api">Piper API 地址</label>
              <input id="piper-api" type="text" value={config.piperApiBase}
                onChange={e => patchConfig({ piperApiBase: e.target.value })} />
            </div>
            <div className="voice-field">
              <label>引擎状态</label>
              <div className="voice-service-row">
                <button type="button" className="btn btn-small" onClick={handleCheckPiper} disabled={checking}>
                  <Icon name="voice" size={13} />{checking ? '检测中…' : '检测服务'}
                </button>
                <span className={`voice-service-badge ${piperHealth === true ? 'online' : piperHealth === false ? 'offline' : ''}`}>
                  {piperHealth === true ? '在线' : piperHealth === false ? '未连接' : '未检测'}
                </span>
              </div>
            </div>
          </div>
          <div className="voice-piper-note">
            <Icon name="volume" size={14} />
            <span>无需参考音频，离线 CPU 合成；首次加载稍慢。模型与 start-piper.bat 由本地服务提供。</span>
          </div>
          <p className="voice-hint">{startPiperHint}</p>
          <p className="voice-hint">默认 API 地址：{DEFAULT_PIPER_API_BASE}（Vite 代理到 127.0.0.1:9881）。</p>
        </>
      )}

      <div className="voice-actions">
        <button type="button" className="btn btn-small btn-primary" onClick={handlePreview} disabled={loading}>
          <Icon name={loading ? 'voice' : 'mic'} size={14} />
          {loading ? '生成中…' : (config.provider === 'browser' ? '试听' : '生成并试听')}
        </button>
        <button type="button" className="btn btn-small" onClick={handleStop}>
          <Icon name="stop" size={13} />停止
        </button>
        {audioUrl && (
          <button type="button" className="btn btn-small" onClick={handleDownload}>
            <Icon name="download" size={13} />下载 wav
          </button>
        )}
      </div>

      {audioUrl && <audio ref={audioRef} className="voice-audio" src={audioUrl} controls preload="auto" />}
      {status && <p className="voice-status"><Icon name="volume" size={13} />{status}</p>}
      {error && (
        <div className="voice-error-box">
          <p className="voice-error">{error}</p>
          <div className="voice-fallback-actions">
            <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'browser' })}>
              改用浏览器语音
            </button>
            <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'piper' })}>
              改用本地 Piper
            </button>
            <button type="button" className="btn btn-small" onClick={() => patchConfig({ provider: 'gpt-sovits' })}>
              改用本地 GPT-SoVITS
            </button>
            <button type="button" className="btn btn-small" onClick={() => { setError(''); setStatus(''); }}>
              清空错误
            </button>
          </div>
        </div>
      )}
      <p className="voice-security">
        安全提示：GPT-SoVITS 的参考音频路径与文本只发送给本机服务，不会上传；浏览器语音与 Piper 完全离线。
        声音仅供本机试听与导出 wav。
      </p>
    </div>
  );
}
