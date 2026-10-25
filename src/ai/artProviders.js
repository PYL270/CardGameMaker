/**
 * AI 绘画 provider 统一层（纯函数优先，便于 UI 冒烟测试）。
 * - Stable Horde：免费·匿名·排队（默认，实测可用）
 * - Pollinations：免 Key，但匿名可能返回官方占位图/限流，建议填 token 或改用 Stable Horde
 * - Hugging Face：用户免费 token，FLUX.1-schnell，返回 blob → dataURL
 * - 本地 Stable Diffusion：WebUI API（需 --api --cors-allow-origins=*）
 * - 自定义 OpenAI 兼容：baseUrl/apiKey/model，b64_json
 *
 * 安全：仅在用户点击生成时外发；只发送提示词，不上传武将数据；
 * token/Key 只存 localStorage（cgm_art_config），不写入武将导出。
 */

export const ART_CONFIG_KEY = 'cgm_art_config';

export const SAFETY_PREFIX = 'safe for work, non-violent, non-sexual, traditional Chinese aesthetic, ';

export const DEFAULT_NEGATIVE = 'nsfw, nude, lowres, bad anatomy, watermark, text, logo, extra fingers, deformed, blurry';

export const STABLE_HORDE_ANON_KEY = '0000000000';
export const STABLE_HORDE_CLIENT_AGENT = 'CardGameMaker:1.0:web';

export const ART_PROVIDERS = [
  {
    id: 'stable-horde',
    label: 'Stable Horde（免费·匿名·排队）',
    short: 'Stable Horde',
    free: true,
    needsKey: false,
    queue: true,
    desc: '免费匿名可用（默认 key 0000000000），CORS 开放；通常排队 1~5 分钟。可填免费 hordeKey 提速，生成期间请耐心等待。',
  },
  {
    id: 'pollinations',
    label: 'Pollinations（免注册·免费·可能占位/限流）',
    short: 'Pollinations',
    free: true,
    needsKey: false,
    defaultModel: 'flux',
    desc: '免 Key，但匿名请求可能返回官方占位图或被限流；建议填免费 token，或改用 Stable Horde。提示词会发往公开服务并被记录。',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face（免费 token）',
    short: 'Hugging Face',
    free: true,
    needsKey: true,
    defaultModel: 'black-forest-labs/FLUX.1-schnell',
    desc: '需在 Hugging Face 设置页创建免费 token；返回图片 blob 后转 dataURL。',
  },
  {
    id: 'local-sd',
    label: '本地 Stable Diffusion（WebUI）',
    short: '本地 Stable Diffusion',
    free: true,
    needsKey: false,
    local: true,
    defaultBaseUrl: 'http://127.0.0.1:7860',
    desc: '需启动 WebUI 并加参数：--api --cors-allow-origins=*；仅本地请求，不上传。',
  },
  {
    id: 'custom',
    label: '自定义 OpenAI 兼容（自填）',
    short: '自定义',
    free: false,
    needsKey: true,
    desc: '填 baseUrl/apiKey/model，用于智谱 / 硅基流动 / OpenAI 等兼容 /v1/images/generations 的服务。',
  },
];

export const DEFAULT_PROVIDER = 'stable-horde';

/** 自定义 OpenAI 兼容的快捷填充（只填 baseUrl/model，不自动请求） */
export const CUSTOM_PRESETS = [
  {
    id: 'zhipu',
    label: '智谱 CogView-3-Flash（免费 Key）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'cogview-3-flash',
    hint: '到 open.bigmodel.cn 创建免费 API Key 后填入',
  },
  {
    id: 'siliconflow',
    label: '硅基流动（免费额度）',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Kwai-Kolors/Kolors',
    hint: '到 siliconflow.cn 创建 API Key 后填入',
  },
];

/**
 * 免费方案引导（不依赖本机 D:\ 路径）：
 * 每项包含 provider / 标签 / 说明；custom 预设带 preset。
 */
export const ART_FREE_GUIDE = [
  {
    id: 'huggingface', provider: 'huggingface', label: 'Hugging Face FLUX.1-schnell',
    tags: ['免费', '需免费 Token'], desc: '免费 token 在 huggingface.co/settings/tokens 创建；浏览器直出图片。',
  },
  {
    id: 'zhipu', provider: 'custom', preset: 'zhipu', label: '智谱 CogView-3-Flash',
    tags: ['免费 Key', '需注册'], desc: 'open.bigmodel.cn 创建免费 Key，OpenAI 兼容 /images/generations。',
  },
  {
    id: 'siliconflow', provider: 'custom', preset: 'siliconflow', label: '硅基流动 Kolors',
    tags: ['免费额度', '需 Key'], desc: 'siliconflow.cn 注册领取免费额度，兼容 OpenAI 图片接口。',
  },
  {
    id: 'pollinations', provider: 'pollinations', label: 'Pollinations',
    tags: ['免注册', '免费', '可能占位/限流'], desc: '无需 Key；匿名可能返回官方占位图，可填免费 token 或改用其他方案。',
  },
  {
    id: 'stable-horde', provider: 'stable-horde', label: 'Stable Horde',
    tags: ['免费', '匿名', '排队'], desc: '免费匿名队列；当前匿名 kudos 紧张时填免费 hordeKey 可提高成功率。',
  },
  {
    id: 'local-sd', provider: 'local-sd', label: '本地 Stable Diffusion',
    tags: ['免费', '需本机 GPU/WebUI'], desc: '需本机启动带 --api 的 WebUI（默认 127.0.0.1:7860）；其他玩家需各自部署。',
  },
];

/** 纯函数：配置完整性 / 可用性自检（不发起网络请求） */
export function inspectArtProvider(providerId, config = {}) {
  const spec = getArtProvider(providerId);
  const cfg = config || {};
  if (spec.id === 'stable-horde') {
    return {
      ok: true,
      provider: spec.id,
      status: cfg.hordeKey ? 'configured' : 'queue',
      label: cfg.hordeKey ? '已填 hordeKey' : '免费·匿名排队',
      message: cfg.hordeKey
        ? '已填写 hordeKey，可保留大尺寸（768×1024 / 1024²）；默认 8 步，排队时间取决于服务。'
        : '匿名免费 512×768 / 8 步（约 5 kudos）；高峰期仍可能排队，填免费 hordeKey 可解锁大图。',
    };
  }
  if (spec.id === 'pollinations') {
    return {
      ok: true,
      provider: spec.id,
      status: cfg.pollinationsToken ? 'configured' : 'degraded',
      label: cfg.pollinationsToken ? '已填 token' : '免注册·可能占位',
      message: cfg.pollinationsToken
        ? '已填写 Pollinations token，额度/成功率更高。'
        : '免 Key，但匿名请求可能返回官方占位图/被限流；建议填免费 token。',
    };
  }
  if (spec.id === 'huggingface') {
    return cfg.huggingfaceToken
      ? { ok: true, provider: spec.id, status: 'configured', label: 'Token 已填', message: '配置完整；生成时由 Hugging Face 校验 token 权限。' }
      : { ok: false, provider: spec.id, status: 'needs-key', label: '缺少 Token', message: '请填写 Hugging Face 免费 token（huggingface.co/settings/tokens）。' };
  }
  if (spec.id === 'local-sd') {
    return {
      ok: true,
      provider: spec.id,
      status: 'local',
      label: '需本地服务',
      message: `将请求 ${cfg.localBaseUrl || spec.defaultBaseUrl || 'http://127.0.0.1:7860'}，需本机 WebUI 以 --api 启动；其他玩家不可直接使用。`,
    };
  }
  const missing = [];
  if (!String(cfg.customBaseUrl || '').trim()) missing.push('Base URL');
  if (!String(cfg.customApiKey || '').trim()) missing.push('API Key');
  if (!String(cfg.customModel || '').trim()) missing.push('模型');
  return missing.length
    ? { ok: false, provider: spec.id, status: 'needs-config', label: '配置不完整', message: `请补齐：${missing.join(' / ')}（智谱/硅基流动可用上方快捷填充）。` }
    : { ok: true, provider: spec.id, status: 'configured', label: '配置完整', message: '配置完整；生成时由自定义服务校验 Key 与模型。' };
}

/** 连接自检（仅用户点击时调用）：Stable Horde / 本地 SD 发 GET；HF/自定义/Pollinations 只查配置 */
export async function checkArtProviderConnection(providerId, config = {}, deps = {}) {
  const inspected = inspectArtProvider(providerId, config);
  if (!inspected.ok) return { ...inspected, error: inspected.message };
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const spec = getArtProvider(providerId);
  if (spec.id === 'stable-horde') {
    if (!fetchImpl) return { ...inspected, ok: false, status: 'offline', error: '当前环境不支持网络请求' };
    try {
      const response = await fetchImpl('https://stablehorde.net/api/v2/status/models', { method: 'GET' });
      if (!response || response.ok === false) {
        return { ...inspected, ok: false, status: 'offline', error: `Stable Horde 状态接口不可用（HTTP ${response?.status || '网络错误'}）：请稍后重试或改用其他免费方案。` };
      }
      const data = await response.json().catch(() => null);
      const count = Array.isArray(data) ? data.length : null;
      return { ...inspected, ok: true, status: 'online', message: count !== null ? `Stable Horde 在线，可用模型 ${count} 个。` : 'Stable Horde 在线。' };
    } catch (e) {
      return { ...inspected, ok: false, status: 'offline', error: `无法连接 Stable Horde：${e?.message || '网络错误'}` };
    }
  }
  if (spec.id === 'local-sd') {
    if (!fetchImpl) return { ...inspected, ok: false, status: 'offline', error: '当前环境不支持网络请求' };
    const base = String(config.localBaseUrl || spec.defaultBaseUrl || 'http://127.0.0.1:7860').replace(/\/+$/, '');
    try {
      const response = await fetchImpl(`${base}/sdapi/v1/sd-models`, { method: 'GET' });
      if (!response || response.ok === false) {
        return { ...inspected, ok: false, status: 'offline', error: `本地 SD 不可用（HTTP ${response?.status || '网络错误'}）：请确认 WebUI 已用 --api 启动。` };
      }
      return { ...inspected, ok: true, status: 'online', message: '本地 SD WebUI 在线。' };
    } catch (e) {
      return { ...inspected, ok: false, status: 'offline', error: `无法连接本地 SD（${base}）：请确认 WebUI 已启动并加 --api --cors-allow-origins=*。` };
    }
  }
  return { ...inspected, ok: true, status: inspected.status, message: inspected.message };
}

export const ART_STYLES = [
  { id: 'ink', label: '水墨国风', prompt: 'Chinese ink wash painting, sumi-e, elegant brush strokes, xuan paper texture, cinematic lighting' },
  { id: 'gongbi', label: '工笔重彩', prompt: 'Chinese gongbi painting, fine brushwork, rich mineral pigments, ornate details, soft light' },
  { id: 'cyber', label: '赛博国潮', prompt: 'cyberpunk Chinese guochao, neon accents, futuristic hanfu, dramatic rim light' },
  { id: 'realistic', label: '写实厚涂', prompt: 'realistic digital painting, impasto brushwork, cinematic portrait, volumetric light, highly detailed' },
];

export const ART_SIZES = [
  { id: 's512', label: '512×768（匿名免费）', width: 512, height: 768 },
  { id: 's768', label: '768×1024（需 hordeKey）', width: 768, height: 1024, needsKey: true },
  { id: 's1024', label: '1024×1024（需 hordeKey）', width: 1024, height: 1024, needsKey: true },
];

export function getArtProvider(id) {
  return ART_PROVIDERS.find(p => p.id === id) || ART_PROVIDERS[0];
}

export function getArtStyle(id) {
  return ART_STYLES.find(s => s.id === id) || ART_STYLES[0];
}

const GROUP_LABELS = {
  wei: '魏', shu: '蜀', wu: '吴', qun: '群', jin: '晋', shen: '神', custom: '自定义',
};

/** 根据武将信息生成默认画面提示词（可编辑） */
export function suggestPrompt({ name = '', group = '', description = '' } = {}) {
  const groupLabel = GROUP_LABELS[group] || '';
  const desc = sanitizePrompt(description, 60);
  return [
    name ? `${name}` : '古风武将',
    '单人半身立绘',
    '正面构图',
    groupLabel ? `${groupLabel}势力` : '',
    desc,
  ].filter(Boolean).join('，');
}

/** 清理提示词：去控制字符、压缩空白、限制长度（默认 600） */
export function sanitizePrompt(prompt, maxLen = 600) {
  const text = String(prompt || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const limit = Math.max(1, Number(maxLen) || 600);
  return text.length > limit ? text.slice(0, limit).trim() : text;
}

/** 构建完整正向提示词：安全前缀 + 武将名 + 风格 + 用户提示词 */
export function buildPrompt({
  prompt = '', characterName = '', style = 'ink', extra = '', maxLen = 600,
} = {}) {
  const stylePrompt = getArtStyle(style).prompt;
  const namePart = characterName ? `portrait of ${characterName}, ` : '';
  const full = `${SAFETY_PREFIX}${namePart}${stylePrompt}${extra ? `, ${extra}` : ''}, ${prompt}`;
  return sanitizePrompt(full, maxLen);
}

/** 构建负面提示词：始终包含默认负面词 */
export function buildNegative(negative = '', maxLen = 400) {
  const extra = sanitizePrompt(negative, maxLen);
  return extra ? `${DEFAULT_NEGATIVE}, ${extra}` : DEFAULT_NEGATIVE;
}

export function normalizeArtSize(width, height) {
  const clamp = (v, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(1536, Math.max(256, Math.round(n / 64) * 64));
  };
  return { width: clamp(width, 768), height: clamp(height, 1024) };
}

export function normalizeSeed(seed) {
  if (seed === '' || seed === null || seed === undefined) return Math.floor(Math.random() * 1e9);
  const n = Math.floor(Number(seed));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(999999999, n);
}

function trimBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function isHttpUrl(url) {
  return /^https?:\/\/[^\s]+$/i.test(String(url || '').trim());
}

/** 自定义 OpenAI 兼容端点：已带 /v1 或 /v4 版本号时不再重复拼接 */
export function customImagesEndpoint(baseUrl) {
  const base = trimBase(baseUrl);
  if (!base) return '';
  if (/\/v\d+$/i.test(base)) return `${base}/images/generations`;
  return `${base}/v1/images/generations`;
}

/** 图片 URL 白名单：http(s) 或 data:image/*，拒绝 javascript:/data:text/html 等 */
export function isSafeImageUrl(url) {
  const text = typeof url === 'string' ? url.trim() : '';
  if (!text || text.length > 6 * 1024 * 1024) return false;
  if (/^https?:\/\//i.test(text)) return true;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(text);
}

/** Stable Horde 匿名免费额度上限（实测约 5 kudos）：512×768 / 8 步可稳定排队 */
export const HORDE_ANON_LIMITS = Object.freeze({ width: 512, height: 768, steps: 8 });

/** 纯函数：按匿名免费额度限制宽高/步数 */
export function applyAnonymousHordeLimits({ width = 768, height = 1024, steps = 24 } = {}) {
  const safeWidth = Math.min(Math.max(64, Number(width) || HORDE_ANON_LIMITS.width), HORDE_ANON_LIMITS.width);
  const safeHeight = Math.min(Math.max(64, Number(height) || HORDE_ANON_LIMITS.height), HORDE_ANON_LIMITS.height);
  const safeSteps = HORDE_ANON_LIMITS.steps;
  const requestedSteps = Math.max(1, Number(steps) || safeSteps);
  const limited = safeWidth !== width || safeHeight !== height || requestedSteps !== safeSteps;
  return {
    width: safeWidth,
    height: safeHeight,
    steps: safeSteps,
    limited,
    note: limited
      ? `已按匿名免费额度调整为 ${safeWidth}×${safeHeight} / ${safeSteps} 步（约 5 kudos）；填 hordeKey 可解锁大图。`
      : '',
  };
}

/** 纯函数：当前 horde 请求是否还能降到匿名安全参数重试一次 */
export function canClampHordeRequest(request) {
  if (!request || !request.ok || request.mode !== 'horde') return false;
  const params = request.body && request.body.params ? request.body.params : {};
  return Number(params.width) > HORDE_ANON_LIMITS.width
    || Number(params.height) > HORDE_ANON_LIMITS.height
    || Number(params.steps) > HORDE_ANON_LIMITS.steps;
}

/** 纯函数：复制请求并 clamp 到 512×768/8 步，供 403 KudosUpfront 自动降级重试 */
export function clampHordeRequestToAnonymous(request) {
  if (!request || !request.ok || request.mode !== 'horde') return request;
  const params = (request.body && request.body.params) || {};
  const safe = applyAnonymousHordeLimits({
    width: params.width,
    height: params.height,
    steps: params.steps,
  });
  return {
    ...request,
    body: {
      ...request.body,
      params: {
        ...params,
        width: safe.width,
        height: safe.height,
        steps: safe.steps,
      },
    },
    width: safe.width,
    height: safe.height,
    budgetLimited: true,
    anonymous: request.anonymous !== false,
    sizeNote: safe.note
      ? `${safe.note}（403 自动降级重试）`
      : `已降级到 ${safe.width}×${safe.height} / ${safe.steps} 步重试（403 自动降级）。`,
  };
}

/** 构建请求描述（纯函数）：{ok, provider, method, url, headers, body, responseType, error} */
export function buildArtRequest({
  provider = DEFAULT_PROVIDER,
  config = {},
  prompt = '',
  negative = '',
  width = null,
  height = null,
  seed = null,
  style = 'ink',
  characterName = '',
  steps = HORDE_ANON_LIMITS.steps,
} = {}) {
  const spec = getArtProvider(provider);
  const fullPrompt = buildPrompt({ prompt, characterName, style });
  const fullNegative = buildNegative(negative);
  if (!fullPrompt || !sanitizePrompt(prompt)) {
    return { ok: false, provider: spec.id, error: '请先填写画面提示词' };
  }
  // 各 provider 默认尺寸不同：Stable Horde 匿名默认 512×768，其它仍 768×1024
  const defaultSize = spec.id === 'stable-horde'
    ? { width: HORDE_ANON_LIMITS.width, height: HORDE_ANON_LIMITS.height }
    : { width: 768, height: 1024 };
  const size = normalizeArtSize(width ?? defaultSize.width, height ?? defaultSize.height);
  const finalSeed = normalizeSeed(seed);

  if (spec.id === 'stable-horde') {
    const hasKey = Boolean(String(config.hordeKey || '').trim());
    const apiKey = String(config.hordeKey || '').trim() || STABLE_HORDE_ANON_KEY;
    const requestedSteps = Math.max(1, Math.min(30, Number(steps) || HORDE_ANON_LIMITS.steps));
    let finalWidth = size.width;
    let finalHeight = size.height;
    let finalSteps = requestedSteps;
    let budgetLimited = false;
    let sizeNote = '';
    if (!hasKey) {
      const limited = applyAnonymousHordeLimits({ width: size.width, height: size.height, steps: requestedSteps });
      finalWidth = limited.width;
      finalHeight = limited.height;
      finalSteps = limited.steps;
      budgetLimited = limited.limited;
      sizeNote = limited.note;
    }
    return {
      ok: true,
      provider: spec.id,
      mode: 'horde',
      responseType: 'horde',
      submitUrl: 'https://stablehorde.net/api/v2/generate/async',
      checkUrlBase: 'https://stablehorde.net/api/v2/generate/check',
      statusUrlBase: 'https://stablehorde.net/api/v2/generate/status',
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Client-Agent': STABLE_HORDE_CLIENT_AGENT,
        'Content-Type': 'application/json',
      },
      body: {
        prompt: fullPrompt,
        params: {
          width: finalWidth,
          height: finalHeight,
          steps: finalSteps,
          cfg_scale: 7,
          nsfw: false,
          seed: String(finalSeed),
          negative_prompt: fullNegative,
        },
        nsfw: false,
        censor_nsfw: true,
        trusted_workers: false,
        slow_workers: true,
        r2: false,
      },
      apiKey,
      anonymous: !hasKey,
      budgetLimited,
      sizeNote,
      requestedWidth: size.width,
      requestedHeight: size.height,
      requestedSteps,
      negative: fullNegative,
      seed: finalSeed,
      width: finalWidth,
      height: finalHeight,
      steps: finalSteps,
      pollIntervalMs: 4500,
      timeoutMs: 600000,
    };
  }

  if (spec.id === 'pollinations') {
    const model = config.model || spec.defaultModel;
    const params = new URLSearchParams({
      width: String(size.width),
      height: String(size.height),
      seed: String(finalSeed),
      nologo: 'true',
      model,
    });
    const token = String(config.pollinationsToken || '').trim();
    if (token) params.set('token', token);
    return {
      ok: true,
      provider: spec.id,
      method: 'GET',
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params.toString()}`,
      headers: {},
      body: null,
      responseType: 'url',
      negative: fullNegative,
      seed: finalSeed,
      width: size.width,
      height: size.height,
      timeoutMs: 90000,
    };
  }

  if (spec.id === 'huggingface') {
    const token = String(config.huggingfaceToken || '').trim();
    if (!token) {
      return { ok: false, provider: spec.id, error: 'Hugging Face 需要免费 token：请到 huggingface.co/settings/tokens 创建后填入（仅保存在本地）' };
    }
    const model = String(config.hfModel || spec.defaultModel).trim();
    const modelPath = model.split('/').map(encodeURIComponent).join('/');
    return {
      ok: true,
      provider: spec.id,
      method: 'POST',
      url: `https://api-inference.huggingface.co/models/${modelPath}`,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: {
        inputs: fullPrompt,
        parameters: {
          negative_prompt: fullNegative,
          width: size.width,
          height: size.height,
          seed: finalSeed,
        },
      },
      responseType: 'blob',
      negative: fullNegative,
      seed: finalSeed,
      width: size.width,
      height: size.height,
      timeoutMs: 120000,
    };
  }

  if (spec.id === 'local-sd') {
    const baseUrl = trimBase(config.localBaseUrl || spec.defaultBaseUrl);
    if (!isHttpUrl(baseUrl)) {
      return { ok: false, provider: spec.id, error: '本地 SD 地址无效，请填写 http://127.0.0.1:7860' };
    }
    return {
      ok: true,
      provider: spec.id,
      method: 'POST',
      url: `${baseUrl}/sdapi/v1/txt2img`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        prompt: fullPrompt,
        negative_prompt: fullNegative,
        width: size.width,
        height: size.height,
        seed: finalSeed,
        steps: 24,
        cfg_scale: 5,
      },
      responseType: 'json',
      negative: fullNegative,
      seed: finalSeed,
      width: size.width,
      height: size.height,
      timeoutMs: 180000,
    };
  }

  if (spec.id === 'custom') {
    const baseUrl = trimBase(config.customBaseUrl);
    const apiKey = String(config.customApiKey || '').trim();
    const model = String(config.customModel || '').trim();
    if (!isHttpUrl(baseUrl)) {
      return { ok: false, provider: spec.id, error: '请填写自定义服务 baseUrl（http/https）' };
    }
    if (!apiKey) {
      return { ok: false, provider: spec.id, error: '请填写自定义服务的 apiKey（仅保存在本地）' };
    }
    if (!model) {
      return { ok: false, provider: spec.id, error: '请填写模型名，如 black-forest-labs/FLUX.1-schnell' };
    }
    return {
      ok: true,
      provider: spec.id,
      method: 'POST',
      url: customImagesEndpoint(baseUrl),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        prompt: fullPrompt,
        negative_prompt: fullNegative,
        size: `${size.width}x${size.height}`,
        response_format: 'b64_json',
        n: 1,
      },
      responseType: 'json',
      negative: fullNegative,
      seed: finalSeed,
      width: size.width,
      height: size.height,
      timeoutMs: 120000,
    };
  }

  return { ok: false, provider: spec.id, error: '不支持的 AI 绘画 provider' };
}

function httpErrorMessage(status, provider) {
  if (status === 401 || status === 403) {
    return provider === 'huggingface'
      ? 'Hugging Face token 无效或无权限（401/403）：请检查 token 是否正确、是否有推理权限'
      : 'API Key 无效或无权限（401/403）：请检查 Key 与模型权限';
  }
  if (status === 429) return '请求过于频繁或额度不足（429）：请稍后重试、降低频率或更换 provider';
  if (status === 503) return '模型正在加载或服务繁忙（503）：请稍后重试';
  return `生成失败（HTTP ${status}）：请检查网络、provider 配置或稍后重试`;
}

/** 解析 Stable Horde 403/401 响应，识别 KudosUpfront（免费匿名额度不足） */
export function analyzeStableHordeError(status, detail = '') {
  const text = String(detail || '');
  const lower = text.toLowerCase();
  if (lower.includes('kudos') || lower.includes('kudosupfront')) {
    return {
      code: 'kudos',
      error: 'Stable Horde 免费匿名额度不足（KudosUpfront）：高峰期匿名 key 需要 kudos 才能生成。可填写免费 hordeKey（stablehorde.net 注册），或改用 Hugging Face / 本地 SD / 自定义 API 等其他免费方案。',
    };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      error: 'Stable Horde 拒绝请求（403）：可能是匿名 key 受限、模型需要 kudos 或服务策略变化。建议填写免费 hordeKey，或切换其他免费方案。',
    };
  }
  if (status === 401) {
    return {
      code: 'auth',
      error: 'Stable Horde 匿名 key 无效（401）：请填写免费 hordeKey（stablehorde.net 注册），或切换其他免费方案。',
    };
  }
  return null;
}

async function readErrorDetail(response) {
  if (!response) return '';
  try {
    if (typeof response.text === 'function') {
      const text = String(await response.text()).slice(0, 300);
      return text;
    }
  } catch {
    // ignore
  }
  return '';
}

function readBlobAsDataUrl(blob, deps) {
  if (deps.blobToDataUrl) return deps.blobToDataUrl(blob);
  if (typeof FileReader === 'undefined') return Promise.reject(new Error('当前环境不支持图片转换'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Stable Horde：提交异步任务 → 每 4.5s 查询 check → done 后取 status 图片。
 * deps 可注入 fetchImpl / sleep / now / onProgress 便于测试。
 */
async function generateHorde(req, params = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { ok: false, provider: req.provider, error: '当前环境不支持网络请求' };
  const sleep = deps.sleep || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
  const now = deps.now || (() => Date.now());
  const progress = typeof params.onProgress === 'function'
    ? params.onProgress
    : (typeof deps.onProgress === 'function' ? deps.onProgress : null);
  const fail = (error, extra = {}) => ({ ok: false, provider: req.provider, error, ...extra });
  const started = now();

  try {
    progress?.({ stage: 'submit', message: '正在提交到 Stable Horde…' });
    let activeReq = req;
    let submitRes = null;
    let analyzedError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      submitRes = await fetchImpl(activeReq.submitUrl, {
        method: activeReq.method,
        headers: activeReq.headers,
        body: JSON.stringify(activeReq.body),
      });
      if (submitRes && submitRes.ok !== false) break;
      const detail = await readErrorDetail(submitRes);
      analyzedError = analyzeStableHordeError(submitRes?.status, detail);
      if (analyzedError?.code === 'kudos' && attempt === 0 && canClampHordeRequest(activeReq)) {
        activeReq = clampHordeRequestToAnonymous(activeReq);
        progress?.({
          stage: 'submit',
          message: activeReq.sizeNote || '匿名额度不足，已自动降级到 512×768 / 8 步重试…',
          budgetLimited: true,
        });
        continue;
      }
      break;
    }
    if (!submitRes || submitRes.ok === false) {
      if (analyzedError) {
        const suffix = activeReq.budgetLimited && analyzedError.code === 'kudos'
          ? '（已自动尝试匿名 512×768 / 8 步，仍额度不足）'
          : '';
        return fail(`${analyzedError.error}${suffix}`, { code: analyzedError.code, budgetLimited: activeReq.budgetLimited });
      }
      if (submitRes?.status === 429) {
        return fail('Stable Horde 请求过于频繁或排队已满（429）：请稍后重试或填写 hordeKey 提速');
      }
      return fail(httpErrorMessage(submitRes?.status, req.provider));
    }
    const submitData = await submitRes.json().catch(() => null);
    const id = submitData?.id;
    if (!id) return fail('Stable Horde 未返回任务 ID：请稍后重试');
    progress?.({ stage: 'queue', id, queuePosition: null, waitTime: null, message: '已提交，排队中…' });

    while (now() - started < req.timeoutMs) {
      await sleep(req.pollIntervalMs);
      const checkRes = await fetchImpl(`${req.checkUrlBase}/${id}`);
      if (!checkRes) return fail('Stable Horde 查询失败：网络无响应');
      if (checkRes.ok === false) {
        const detail = await readErrorDetail(checkRes);
        const analyzed = analyzeStableHordeError(checkRes.status, detail);
        if (analyzed) return fail(analyzed.error, { code: analyzed.code });
        if (checkRes.status === 429) {
          progress?.({ stage: 'queue', message: '排队中（服务限流，自动等待）…' });
          continue;
        }
        if (checkRes.status === 404) {
          return fail('Stable Horde 任务不存在（404）：可能已过期或被取消，请重新生成');
        }
        return fail(httpErrorMessage(checkRes.status, req.provider));
      }
      const check = await checkRes.json().catch(() => null);
      if (!check || !check.done) {
        const queuePosition = Number(check?.queue_position);
        const waitTime = Number(check?.wait_time);
        progress?.({
          stage: check?.processing ? 'generating' : 'queue',
          queuePosition: Number.isFinite(queuePosition) ? queuePosition : null,
          waitTime: Number.isFinite(waitTime) ? waitTime : null,
          processing: !!check?.processing,
          message: check?.processing ? '正在生成…' : '排队中…',
        });
        continue;
      }

      progress?.({ stage: 'download', message: '下载图片…' });
      const statusRes = await fetchImpl(`${req.statusUrlBase}/${id}`);
      if (!statusRes || statusRes.ok === false) {
        return fail(httpErrorMessage(statusRes?.status, req.provider));
      }
      const status = await statusRes.json().catch(() => null);
      const img = status?.generations?.[0]?.img;
      if (!img) return fail('Stable Horde 生成完成但没有返回图片（可能被 censored），请调整提示词后重试');
      const text = String(img);
      if (text.startsWith('data:image/')) {
        return { ok: true, provider: req.provider, imageUrl: text, budgetLimited: !!activeReq.budgetLimited };
      }
      // r2:false 时返回 base64 图片（webp/png/jpg），转成 dataURL 持久保存
      if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length > 100) {
        const clean = text.replace(/\s/g, '');
        let mime = 'image/webp';
        if (clean.startsWith('iVBOR')) mime = 'image/png';
        else if (clean.startsWith('/9j/')) mime = 'image/jpeg';
        return { ok: true, provider: req.provider, imageUrl: `data:${mime};base64,${clean}`, budgetLimited: !!activeReq.budgetLimited };
      }
      if (isSafeImageUrl(text)) {
        return { ok: true, provider: req.provider, imageUrl: text, budgetLimited: !!activeReq.budgetLimited };
      }
      return fail('Stable Horde 返回的图片地址不受支持');
    }

    return fail('Stable Horde 排队超时（600 秒）：队列较忙，请稍后重试或填写免费 hordeKey 提速');
  } catch (e) {
    return fail(`Stable Horde 生成失败：${e?.message || '网络错误'}`);
  }
}

/**
 * 统一生成：返回 {ok, imageUrl, provider, error}
 * deps 可注入 fetchImpl / blobToDataUrl / sleep / now 便于测试。
 */
export async function generateArt(params = {}, deps = {}) {
  const req = buildArtRequest(params);
  if (!req.ok) return { ok: false, provider: req.provider, error: req.error };
  if (req.mode === 'horde') return generateHorde(req, params, deps);
  // Pollinations 返回的是可直接嵌入 <img> 的图片 URL：
  // 浏览器 fetch 该地址会被服务端 403（反爬），但 <img> 加载正常，因此不预取。
  if (req.responseType === 'url') {
    return { ok: true, provider: req.provider, imageUrl: req.url };
  }
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { ok: false, provider: req.provider, error: '当前环境不支持网络请求' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller && req.timeoutMs
    ? setTimeout(() => controller.abort(), req.timeoutMs)
    : null;
  try {
    const response = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: controller?.signal,
    });
    if (!response || response.ok === false) {
      return { ok: false, provider: req.provider, error: httpErrorMessage(response?.status, req.provider) };
    }
    if (req.responseType === 'url') {
      return { ok: true, provider: req.provider, imageUrl: req.url };
    }
    if (req.responseType === 'blob') {
      const blob = await response.blob();
      const dataUrl = await readBlobAsDataUrl(blob, deps);
      if (!isSafeImageUrl(dataUrl)) {
        return { ok: false, provider: req.provider, error: '服务返回的图片格式不受支持' };
      }
      return { ok: true, provider: req.provider, imageUrl: dataUrl };
    }
    const data = await response.json();
    if (req.provider === 'local-sd') {
      const base64 = data?.images?.[0];
      if (!base64) return { ok: false, provider: req.provider, error: '本地 SD 未返回图片，请检查 WebUI 日志' };
      return { ok: true, provider: req.provider, imageUrl: `data:image/png;base64,${base64}` };
    }
    const first = data?.data?.[0];
    if (first?.b64_json) {
      return { ok: true, provider: req.provider, imageUrl: `data:image/png;base64,${first.b64_json}` };
    }
    if (first?.url && isSafeImageUrl(first.url)) {
      return { ok: true, provider: req.provider, imageUrl: first.url };
    }
    return { ok: false, provider: req.provider, error: '服务未返回图片（b64_json/url 均为空）' };
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { ok: false, provider: req.provider, error: '生成超时：请稍后重试或更换 provider（本地 SD 首次加载可能较慢）' };
    }
    return { ok: false, provider: req.provider, error: `生成失败：${e?.message || '网络错误'}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------------- 本地配置（只存 localStorage，不进入导出） ---------------- */

const CONFIG_DEFAULTS = {
  provider: DEFAULT_PROVIDER,
  style: 'ink',
  hordeKey: '',
  pollinationsToken: '',
  huggingfaceToken: '',
  hfModel: 'black-forest-labs/FLUX.1-schnell',
  localBaseUrl: 'http://127.0.0.1:7860',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
};

function resolveArtStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* SSR/隐私模式 */ }
  return null;
}

export function readArtConfig(storage) {
  const store = resolveArtStorage(storage);
  if (!store) return { ...CONFIG_DEFAULTS };
  try {
    const raw = store.getItem(ART_CONFIG_KEY);
    if (!raw) return { ...CONFIG_DEFAULTS };
    const cfg = JSON.parse(raw);
    const out = { ...CONFIG_DEFAULTS };
    for (const key of Object.keys(CONFIG_DEFAULTS)) {
      if (typeof CONFIG_DEFAULTS[key] === 'string' && typeof cfg?.[key] === 'string') out[key] = cfg[key];
    }
    return out;
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

export function saveArtConfig(config, storage) {
  const store = resolveArtStorage(storage);
  if (!store) return false;
  try {
    const safe = {};
    const merged = { ...CONFIG_DEFAULTS, ...(config || {}) };
    for (const key of Object.keys(CONFIG_DEFAULTS)) {
      safe[key] = typeof merged[key] === 'string' ? merged[key] : CONFIG_DEFAULTS[key];
    }
    store.setItem(ART_CONFIG_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
