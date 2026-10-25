import React, { useEffect, useRef, useState } from 'react';
import Select from '../ui/Select';
import {
  ART_FREE_GUIDE,
  ART_PROVIDERS,
  ART_SIZES,
  ART_STYLES,
  CUSTOM_PRESETS,
  DEFAULT_PROVIDER,
  checkArtProviderConnection,
  generateArt,
  inspectArtProvider,
  isSafeImageUrl,
  readArtConfig,
  saveArtConfig,
  suggestPrompt,
  buildNegative,
} from '../../ai/artProviders';
import { imageFileToDataUrl } from '../../ai/imageImport';
import Portrait from '../ui/Portrait';

/**
 * ArtStudio - AI 立绘工作室（嵌在武将编辑器立绘区）
 * 生成/导入/URL 三种方式，统一应用到 Character.imageUrl。
 */
export default function ArtStudio({
  name = '', group = '', description = '', imageUrl = '', onApply,
}) {
  const [config, setConfig] = useState(() => readArtConfig());
  const [provider, setProvider] = useState(() => readArtConfig().provider || DEFAULT_PROVIDER);
  const [style, setStyle] = useState(() => readArtConfig().style || 'ink');
  const [prompt, setPrompt] = useState(() => suggestPrompt({ name, group, description }));
  const [negative, setNegative] = useState('');
  const [sizeId, setSizeId] = useState('s512');
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const promptTouched = useRef(false);
  const fileRef = useRef(null);

  // 武将名/势力/描述变化时，未手动改过提示词则自动预填
  useEffect(() => {
    if (!promptTouched.current) setPrompt(suggestPrompt({ name, group, description }));
  }, [name, group, description]);

  const providerSpec = ART_PROVIDERS.find(p => p.id === provider) || ART_PROVIDERS[0];
  const size = ART_SIZES.find(s => s.id === sizeId) || ART_SIZES[1];

  const updateConfig = (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveArtConfig(next);
    if (patch.provider) setProvider(patch.provider);
    if (patch.style) setStyle(patch.style);
  };

  const generate = async () => {
    if (loading) return;
    if (!prompt.trim()) { setError('请先填写画面提示词'); return; }
    setError('');
    setErrorInfo(null);
    setMessage('');
    setProgress(null);
    setLoading(true);
    try {
      const res = await generateArt({
        provider,
        config,
        prompt,
        negative,
        width: size.width,
        height: size.height,
        seed: seed === '' ? null : seed,
        style,
        characterName: name,
        onProgress: (p) => setProgress(p),
      });
      if (res.ok) {
        setResult(res.imageUrl);
        setMessage(res.budgetLimited
          ? '生成完成：匿名免费额度已自动使用 512×768 / 8 步；预览后点「应用为立绘」。'
          : '生成完成，预览后点「应用为立绘」写入武将。');
      } else {
        setError(res.error || '生成失败，请稍后重试');
        setErrorInfo({ code: res.code || '', provider: res.provider || provider });
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const checkProvider = async () => {
    if (checking) return;
    setChecking(true);
    setCheckResult(null);
    const res = await checkArtProviderConnection(provider, config);
    setCheckResult(res);
    if (res.ok) {
      setError('');
      setMessage(res.message || '自检通过');
    } else {
      setError(res.error || res.message || '自检未通过');
    }
    setChecking(false);
  };

  const switchProvider = (id, presetId) => {
    if (presetId) {
      const preset = CUSTOM_PRESETS.find(p => p.id === presetId);
      if (preset) {
        updateConfig({ customBaseUrl: preset.baseUrl, customModel: preset.model, provider: 'custom' });
        setMessage(`已切换到【${preset.label}】，请填写/确认 API Key 后生成。`);
      }
    } else {
      updateConfig({ provider: id });
      setMessage(`已切换到「${(ART_PROVIDERS.find(p => p.id === id) || {}).short || id}」，可直接重试或先检查配置。`);
    }
    setError('');
    setErrorInfo(null);
    setCheckResult(null);
  };

  const applyFreeGuide = (item) => switchProvider(item.provider, item.preset);

  const applyImage = (url) => {
    const target = String(url || '').trim();
    if (!target) { setError('还没有可应用的图片'); return; }
    if (!isSafeImageUrl(target)) { setError('仅支持 http(s) 或 data:image 图片地址，已拒绝不安全格式'); return; }
    if (onApply) onApply(target);
    setError('');
    setMessage('已应用为立绘（保存武将后生效）');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    const res = await imageFileToDataUrl(file);
    if (res.ok) {
      setResult(res.dataUrl);
      setError('');
      setMessage(`本地图片已导入并压缩为 ${res.width}×${res.height}，点「应用为立绘」生效。`);
    } else {
      setError(res.error || '图片导入失败');
    }
  };

  const useUrl = () => {
    const url = urlInput.trim();
    if (!isSafeImageUrl(url)) {
      setError('仅支持 http(s) 或 data:image 图片地址（拒绝 javascript: 等协议）');
      return;
    }
    setResult(url);
    setError('');
    setMessage('已载入图片 URL，预览后点「应用为立绘」生效。');
  };

  const randomSeed = () => setSeed(String(Math.floor(Math.random() * 1e9)));

  const fillCustomPreset = (preset) => {
    updateConfig({ customBaseUrl: preset.baseUrl, customModel: preset.model });
    setMessage(`已填入【${preset.label}】的地址与模型，请填写/确认 API Key 后再生成。${preset.hint}`);
  };

  const progressText = (() => {
    if (!loading) return '';
    if (!progress || progress.stage === 'submit') return '提交中…';
    if (progress.stage === 'queue') {
      return progress.queuePosition
        ? `排队第 ${progress.queuePosition} 位…`
        : (progress.message || '排队中…');
    }
    if (progress.stage === 'generating') return '正在生成…';
    if (progress.stage === 'download') return '下载图片…';
    return '生成中…';
  })();

  return (
    <section className="art-studio">
      <div className="art-head">
        <h4>立绘 / AI 绘画</h4>
        <span className="art-badge">默认 Stable Horde · 匿名 512×768/8 步</span>
      </div>

      <div className="art-preview-row">
        <div className="art-preview">
          <Portrait src={imageUrl} name={name} size={96} className="art-current" />
          <span>当前立绘</span>
        </div>
        <div className="art-preview">
          {result && isSafeImageUrl(result)
            ? <img src={result} alt="生成结果预览" className="art-result-img" />
            : <div className="art-result-empty">暂无生成结果</div>}
          <span>生成结果</span>
        </div>
        <div className="art-actions">
          <button className="btn btn-primary btn-small" onClick={generate} disabled={loading}>
            {loading ? '生成中…' : 'AI 生成立绘'}
          </button>
          <button className="btn btn-small" onClick={() => fileRef.current?.click()} disabled={loading}>
            导入本地图片
          </button>
          <button className="btn btn-small" onClick={() => applyImage(result)} disabled={!result || loading}>
            应用为立绘
          </button>
          <button className="btn btn-small" onClick={generate} disabled={loading || !prompt.trim()}>
            重新生成
          </button>
        </div>
      </div>

      <div className="art-form">
        <div className="form-group">
          <label>AI 绘画服务</label>
          <Select value={provider} onChange={e => updateConfig({ provider: e.target.value })}>
            {ART_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
          <div className="art-provider-badges">
            <span className={`art-free-badge ${providerSpec.free ? 'free' : 'paid'}`}>
              {providerSpec.free ? '免费' : '需 Key/付费'}
            </span>
            {providerSpec.needsKey && <span className="art-key-badge">需配置 Key</span>}
            {providerSpec.queue && <span className="art-queue-badge">排队 1~5 分钟</span>}
            <span className={`art-readiness ${inspectArtProvider(provider, config).ok ? 'ok' : 'warn'}`}>
              {inspectArtProvider(provider, config).label}
            </span>
          </div>
          <p className="art-provider-desc">{providerSpec.desc}</p>
          <div className="art-check-row">
            <button type="button" className="btn btn-small" onClick={checkProvider} disabled={checking || loading}>
              {checking ? '检测中…' : '检查配置 / 连接'}
            </button>
            {checkResult && (
              <span className={`art-check-status ${checkResult.ok ? 'ok' : 'err'}`}>{checkResult.message}</span>
            )}
          </div>
          {provider === 'pollinations' && (
            <p className="art-warning">
              Pollinations 匿名请求可能返回官方占位图或被限流；建议填写免费 token，或直接改用 Stable Horde。
            </p>
          )}
          {provider === 'stable-horde' && (
            <p className="art-warning">
              匿名免费：512×768 / 8 步（约 5 kudos），高峰期仍可能排队；填 hordeKey 可解锁 768×1024 / 1024² 大图。
              匿名请求超出额度会自动降到 512×768 / 8 步。
            </p>
          )}

          <details className="art-free-guide">
            <summary>免费方案引导（不依赖本机路径 · 点选即切换）</summary>
            <div className="art-free-list">
              {ART_FREE_GUIDE.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`art-free-item ${provider === item.provider ? 'active' : ''}`}
                  onClick={() => applyFreeGuide(item)}>
                  <span className="art-free-item-head">
                    <b>{item.label}</b>
                    <span className="art-free-tags">
                      {item.tags.map(tag => <em key={tag}>{tag}</em>)}
                    </span>
                    <span className="art-free-switch">切换</span>
                  </span>
                  <span className="art-free-desc">{item.desc}</span>
                </button>
              ))}
            </div>
            <p className="art-hint">
              标签说明：免费 / 需 Key / 需本地。Hugging Face、智谱、硅基流动需各自免费注册 Key；
              本地 SD 需本机部署，其他玩家不可共用；所有 Key 只存本机 cgm_art_config。
            </p>
          </details>
        </div>

        {provider === 'stable-horde' && (
          <div className="form-group">
            <label>Stable Horde Key（可选，仅本地保存）</label>
            <input type="password" value={config.hordeKey || ''}
              placeholder="留空使用匿名 key 0000000000"
              onChange={e => updateConfig({ hordeKey: e.target.value })} />
            <p className="art-hint">
              免费匿名 key 为 0000000000；到 stablehorde.net 注册可获取个人 key 提速。排队 1~5 分钟属正常，请勿重复点击。
            </p>
          </div>
        )}
        {provider === 'pollinations' && (
          <div className="form-group">
            <label>Pollinations Token（可选，仅本地保存）</label>
            <input type="password" value={config.pollinationsToken || ''}
              placeholder="可留空；匿名可能占位/限流"
              onChange={e => updateConfig({ pollinationsToken: e.target.value })} />
          </div>
        )}

        {provider === 'huggingface' && (
          <div className="art-config">
            <div className="form-group">
              <label>Hugging Face Token（仅本地保存）</label>
              <input type="password" value={config.huggingfaceToken || ''}
                placeholder="hf_xxx"
                onChange={e => updateConfig({ huggingfaceToken: e.target.value })} />
            </div>
            <div className="form-group">
              <label>模型</label>
              <input type="text" value={config.hfModel || ''}
                onChange={e => updateConfig({ hfModel: e.target.value })} />
            </div>
          </div>
        )}
        {provider === 'local-sd' && (
          <div className="form-group">
            <label>本地 WebUI 地址</label>
            <input type="text" value={config.localBaseUrl || ''}
              placeholder="http://127.0.0.1:7860"
              onChange={e => updateConfig({ localBaseUrl: e.target.value })} />
            <p className="art-hint">启动参数：--api --cors-allow-origins=*（仅本地请求）</p>
          </div>
        )}
        {provider === 'custom' && (
          <div className="art-config">
            <div className="form-group">
              <label>Base URL</label>
              <input type="text" value={config.customBaseUrl || ''}
                placeholder="https://api.example.com"
                onChange={e => updateConfig({ customBaseUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label>API Key（仅本地保存）</label>
              <input type="password" value={config.customApiKey || ''}
                onChange={e => updateConfig({ customApiKey: e.target.value })} />
            </div>
            <div className="form-group">
              <label>模型</label>
              <input type="text" value={config.customModel || ''}
                placeholder="如 black-forest-labs/FLUX.1-schnell"
                onChange={e => updateConfig({ customModel: e.target.value })} />
            </div>
            <div className="form-group art-preset-group">
              <label>快捷填充（只填地址/模型，不自动请求）</label>
              <div className="art-preset-buttons">
                {CUSTOM_PRESETS.map(p => (
                  <button key={p.id} className="btn btn-small" onClick={() => fillCustomPreset(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="art-row">
          <div className="form-group">
            <label>风格预设</label>
            <Select value={style} onChange={e => updateConfig({ style: e.target.value })}>
              {ART_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div className="form-group">
            <label>尺寸</label>
            <Select value={sizeId} onChange={e => setSizeId(e.target.value)}>
              {ART_SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            {provider === 'stable-horde' && size.needsKey && !String(config.hordeKey || '').trim() && (
              <p className="art-hint warn">该尺寸需 hordeKey；匿名生成会自动降到 512×768 / 8 步。</p>
            )}
          </div>
          <div className="form-group">
            <label>Seed</label>
            <div className="art-seed-row">
              <input type="number" min={0} value={seed} placeholder="随机"
                onChange={e => setSeed(e.target.value)} />
              <button className="btn btn-small" onClick={randomSeed}>随机</button>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>画面提示词（自动预填，可编辑）</label>
          <textarea value={prompt} rows={3}
            onChange={e => { promptTouched.current = true; setPrompt(e.target.value); }} />
        </div>
        <div className="form-group">
          <label>负面提示词（默认已含 nsfw / lowres / bad anatomy / watermark）</label>
          <input type="text" value={negative}
            placeholder={buildNegative('')}
            onChange={e => setNegative(e.target.value)} />
        </div>

        <div className="art-url-row">
          <input type="text" value={urlInput} placeholder="粘贴图片 URL（http(s) 或 data:image）"
            onChange={e => setUrlInput(e.target.value)} />
          <button className="btn btn-small" onClick={useUrl}>使用图片 URL</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            className="art-file-input" onChange={handleFile} />
        </div>

        {loading && (
          <p className="art-message">
            {progressText}
            {provider === 'stable-horde' ? '（Stable Horde 通常需 1~5 分钟，排队久属正常，请勿重复点击）' : ''}
          </p>
        )}
        {error && (
          <div className="art-error-box">
            <p className="art-error">{error}</p>
            <div className="art-error-actions">
              <button type="button" className="btn btn-small btn-primary" onClick={generate} disabled={loading}>
                重试
              </button>
              <button type="button" className="btn btn-small" onClick={() => switchProvider('huggingface')}>
                改用 Hugging Face
              </button>
              <button type="button" className="btn btn-small" onClick={() => switchProvider('local-sd')}>
                使用本地 SD
              </button>
              <button type="button" className="btn btn-small" onClick={() => switchProvider('custom')}>
                改用自定义 API
              </button>
              <button type="button" className="btn btn-small" onClick={() => { setError(''); setErrorInfo(null); setCheckResult(null); }}>
                清空错误
              </button>
            </div>
            {errorInfo && errorInfo.code === 'kudos' && (
              <p className="art-hint">
                匿名 key 0000000000 在高峰期需要 kudos；填写免费 hordeKey 后再重试，或直接切换上方免费方案。
              </p>
            )}
          </div>
        )}
        {message && !error && <p className="art-message">{message}</p>}
      </div>

      <p className="art-security">
        安全提示：token / API Key 仅保存在本机 localStorage（cgm_art_config），不会写入武将导出；
        点击生成时只发送提示词给所选服务，Pollinations / Hugging Face 等免费服务可能记录提示词；
        请勿生成 NSFW、暴力、违法或侵犯他人肖像权的内容。
      </p>
    </section>
  );
}
