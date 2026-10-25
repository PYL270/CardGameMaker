/**
 * voiceTTS - AI 配音：浏览器内置 speechSynthesis（免费）
 *            + 本地 GPT-SoVITS（音色克隆，/voice-api → 9880）
 *            + 本地 Piper（离线 CPU，/piper-api → 9881）
 *
 * 安全：参考音频路径 / 参考文本只发送给本机 GPT-SoVITS 服务（经 Vite /voice-api 代理），
 * 不上传任何第三方。浏览器语音与 Piper 均完全离线。
 */

export const VOICE_CONFIG_KEY = 'cgm_voice_config';

export const DEFAULT_VOICE_API_BASE = '/voice-api';
export const DEFAULT_PIPER_API_BASE = '/piper-api';
export const DEFAULT_VOICE_REF = 'D:\\CardGameMaker\\voice_refs\\ref-zh.wav';
export const DEFAULT_VOICE_PROMPT = '这是一段中文旁白，语气沉稳。';
export const VOICE_TEXT_LIMIT = 200;
export const PIPER_TEXT_LIMIT = 300;

export const VOICE_PROVIDERS = [
  { id: 'browser', label: '浏览器语音（免费内置）', local: false, needsRef: false, free: true },
  { id: 'gpt-sovits', label: '本地 GPT-SoVITS（需 start-voice.bat）', local: true, needsRef: true, free: true },
  { id: 'piper', label: 'Piper 离线（免费开源）', local: true, needsRef: false, free: true, offline: true },
];

export const DEFAULT_VOICE_CONFIG = {
  provider: 'browser',
  browserVoice: '',
  rate: 1,
  pitch: 1,
  apiBase: DEFAULT_VOICE_API_BASE,
  piperApiBase: DEFAULT_PIPER_API_BASE,
  refAudioPath: DEFAULT_VOICE_REF,
  promptText: DEFAULT_VOICE_PROMPT,
  speed: 1,
};

export function clampVoiceNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

export function normalizeVoiceText(text, limit = VOICE_TEXT_LIMIT) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function isSpeechSupported(scope = globalThis) {
  try {
    return !!(scope && scope.speechSynthesis && typeof scope.SpeechSynthesisUtterance === 'function');
  } catch {
    return false;
  }
}

/** 浏览器语音列表：中文优先，其次按名称排序（SSR/无语音环境返回 []） */
export function listBrowserVoices(scope = globalThis) {
  if (!isSpeechSupported(scope)) return [];
  try {
    const voices = Array.from(scope.speechSynthesis.getVoices() || []);
    return voices
      .filter(v => v && v.name)
      .sort((a, b) => {
        const az = String(a.lang || '').toLowerCase().startsWith('zh');
        const bz = String(b.lang || '').toLowerCase().startsWith('zh');
        if (az !== bz) return az ? -1 : 1;
        return String(a.name).localeCompare(String(b.name), 'zh');
      });
  } catch {
    return [];
  }
}

export function pickChineseVoice(voices = []) {
  return voices.find(v => String(v.lang || '').toLowerCase().startsWith('zh')) || voices[0] || null;
}

/**
 * 等待浏览器异步加载语音列表（voiceschanged），最多 timeoutMs（默认 2000ms）。
 * 无需语音环境 / 超时都 resolve；调用方仍应尝试默认 utterance。
 */
export function waitForBrowserVoices(timeoutMs = 2000, scope = globalThis) {
  return new Promise(resolve => {
    if (!isSpeechSupported(scope)) { resolve([]); return; }
    const initial = listBrowserVoices(scope);
    if (initial.length > 0) { resolve(initial); return; }
    const synth = scope.speechSynthesis;
    let finished = false;
    let timer = null;
    const handler = () => {
      if (listBrowserVoices(scope).length > 0) finish();
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        if (typeof synth.removeEventListener === 'function') synth.removeEventListener('voiceschanged', handler);
        else if (synth.onvoiceschanged === handler) synth.onvoiceschanged = null;
      } catch {
        // ignore
      }
    };
    function finish() {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(listBrowserVoices(scope));
    }
    try {
      if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', handler);
      else synth.onvoiceschanged = handler;
    } catch {
      // ignore
    }
    timer = setTimeout(finish, Math.max(0, Number(timeoutMs) || 0));
  });
}

/** 浏览器 speechSynthesis 错误 → 中文可操作提示 */
export function speechErrorMessage(error) {
  const code = error && (error.error || error.code || error.name);
  if (code === 'not-allowed') return '浏览器阻止了语音播放：请点击页面后重试，或检查浏览器自动播放/麦克风权限设置。';
  if (code === 'audio-busy') return '音频设备忙：请关闭其他播放声音的页面后重试。';
  if (code === 'synthesis-failed' || code === 'synthesis-unavailable') {
    return '系统未安装中文语音：Windows 设置 → 时间和语言 → 语音 → 添加中文语音；或改用本地 Piper / GPT-SoVITS。';
  }
  if (code === 'voice-unavailable') return '当前系统语音不可用：请安装中文语音，或改用本地 Piper / GPT-SoVITS。';
  return '浏览器语音播放失败：请安装中文语音（Windows 设置 → 时间和语言 → 语音），或改用本地 Piper / GPT-SoVITS。';
}

export function normalizeApiBase(apiBase, fallback = DEFAULT_VOICE_API_BASE) {
  const text = String(apiBase || fallback).trim();
  if (!text) return fallback;
  return text.replace(/\/+$/, '');
}

export function normalizeRefAudioPath(path) {
  const text = String(path || '').trim();
  if (!text) return '';
  return text.replace(/\//g, '\\');
}

/** 纯函数：构造 GPT-SoVITS /tts 请求，便于测试与展示 */
export function buildVoiceRequest({
  text,
  textLang = 'zh',
  refAudioPath = DEFAULT_VOICE_REF,
  promptText = DEFAULT_VOICE_PROMPT,
  promptLang = 'zh',
  speed = 1,
  apiBase = DEFAULT_VOICE_API_BASE,
} = {}) {
  const cleanText = normalizeVoiceText(text);
  if (!cleanText) return { ok: false, error: '请先填写试听文本' };
  const cleanRef = normalizeRefAudioPath(refAudioPath);
  if (!cleanRef) return { ok: false, error: '请填写参考音频路径（GPT-SoVITS 需要本机 wav 文件）' };
  const cleanPrompt = normalizeVoiceText(promptText, 120);
  if (!cleanPrompt) return { ok: false, error: '请填写参考音频对应的文本' };
  return {
    ok: true,
    url: `${normalizeApiBase(apiBase)}/tts`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      text: cleanText,
      text_lang: textLang || 'zh',
      ref_audio_path: cleanRef,
      prompt_text: cleanPrompt,
      prompt_lang: promptLang || 'zh',
      media_type: 'wav',
      streaming_mode: false,
      speed_factor: clampVoiceNumber(speed, 0.5, 2, 1),
    },
    timeoutMs: 60000,
  };
}

/** 错误状态 → 中文提示（默认引导启动 start-voice.bat） */
export function mapVoiceError(status, detail = '') {
  if (status === 400) return `GPT-SoVITS 请求参数错误（400）${detail ? `：${detail}` : ''}，请检查参考音频路径与参考文本`;
  if (status === 401 || status === 403) return 'GPT-SoVITS 未授权（401/403）：请检查本地 API 配置';
  if (status === 404) return 'GPT-SoVITS 接口不存在（404）：请确认 API 地址（默认 /voice-api → 127.0.0.1:9880）';
  if (status === 503) return 'GPT-SoVITS 服务不可用（503）：请先双击根目录 start-voice.bat 启动本地服务';
  if (status === 500) return `GPT-SoVITS 生成失败（500）${detail ? `：${detail}` : ''}，请查看 start-voice.bat 窗口的报错`;
  return `GPT-SoVITS 请求失败（${status || '网络错误'}）${detail ? `：${detail}` : ''}，请确认 start-voice.bat 已启动`;
}

export function voiceErrorFromException(error) {
  if (!error) return 'GPT-SoVITS 生成失败：未知错误';
  if (error.name === 'AbortError') return 'GPT-SoVITS 生成超时：首次加载模型较慢，请稍后重试';
  if (error.name === 'TypeError' || /Failed to fetch|NetworkError|network/i.test(String(error.message || ''))) {
    return '无法连接本地 GPT-SoVITS：请先双击根目录 start-voice.bat 启动服务（默认 127.0.0.1:9880）';
  }
  return `GPT-SoVITS 生成失败：${error.message || '未知错误'}`;
}

/* ---------------- 浏览器语音 ---------------- */

/**
 * 浏览器朗读（免费内置）。返回 Promise<{ok, utterance}>。
 * voices 为空时仍会尝试用默认 utterance（lang zh-CN），不提前失败；
 * 运行期错误通过 onError 回调上报中文可操作提示。
 */
export async function speakText(text, {
  voice = null,
  rate = 1,
  pitch = 1,
  volume = 1,
  lang = 'zh-CN',
  scope = globalThis,
  onEnd = null,
  onError = null,
} = {}) {
  const clean = normalizeVoiceText(text);
  if (!clean) return { ok: false, error: '请先填写试听文本' };
  if (!isSpeechSupported(scope)) {
    return { ok: false, error: '当前浏览器不支持内置语音：请改用本地 Piper / GPT-SoVITS，或使用支持语音的浏览器。' };
  }
  try {
    const synth = scope.speechSynthesis;
    synth.cancel();
    const utterance = new scope.SpeechSynthesisUtterance(clean);
    const effectiveVoice = voice || pickChineseVoice(listBrowserVoices(scope));
    if (effectiveVoice) utterance.voice = effectiveVoice;
    utterance.rate = clampVoiceNumber(rate, 0.5, 2, 1);
    utterance.pitch = clampVoiceNumber(pitch, 0, 2, 1);
    utterance.volume = clampVoiceNumber(volume, 0, 1, 1);
    utterance.lang = (effectiveVoice && effectiveVoice.lang) || lang || 'zh-CN';
    if (typeof onEnd === 'function') utterance.onend = onEnd;
    utterance.onerror = (event) => {
      const message = speechErrorMessage(event);
      if (typeof onError === 'function') onError(message, event);
    };
    synth.speak(utterance);
    return { ok: true, utterance };
  } catch (error) {
    return { ok: false, error: speechErrorMessage(error) };
  }
}

export function stopSpeech(scope = globalThis) {
  try {
    if (isSpeechSupported(scope)) {
      scope.speechSynthesis.cancel();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/* ---------------- 本地 GPT-SoVITS ---------------- */

/**
 * 生成 GPT-SoVITS 语音，返回 {ok, audioUrl, blob}。
 * deps.fetchImpl / createObjectUrl 可注入测试；超时用 AbortController。
 */
export async function generateGptSpeech({
  text,
  textLang = 'zh',
  refAudioPath = DEFAULT_VOICE_REF,
  promptText = DEFAULT_VOICE_PROMPT,
  promptLang = 'zh',
  speed = 1,
  apiBase = DEFAULT_VOICE_API_BASE,
  timeoutMs = 60000,
} = {}, deps = {}) {
  const request = buildVoiceRequest({
    text, textLang, refAudioPath, promptText, promptLang, speed, apiBase,
  });
  if (!request.ok) return { ok: false, error: request.error };
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { ok: false, error: '当前环境不支持网络请求' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer = null;
  if (controller) {
    timer = setTimeout(() => controller.abort(), timeoutMs || request.timeoutMs);
  }
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response || response.ok === false) {
      let detail = '';
      try {
        if (response && typeof response.text === 'function') {
          detail = String(await response.text()).slice(0, 160);
        }
      } catch {
        // ignore
      }
      return { ok: false, error: mapVoiceError(response && response.status, detail) };
    }
    const blob = await response.blob();
    if (!blob || (typeof blob.size === 'number' && blob.size === 0)) {
      return { ok: false, error: 'GPT-SoVITS 返回空音频：请检查参考音频与参考文本' };
    }
    let audioUrl = '';
    if (typeof deps.createObjectUrl === 'function') {
      audioUrl = deps.createObjectUrl(blob);
    } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      audioUrl = URL.createObjectURL(blob);
    }
    if (!audioUrl) return { ok: false, error: '无法创建试听音频地址' };
    return { ok: true, audioUrl, blob };
  } catch (error) {
    return { ok: false, error: voiceErrorFromException(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function revokeVoiceUrl(url, scope = globalThis) {
  if (!url) return false;
  try {
    if (scope && scope.URL && typeof scope.URL.revokeObjectURL === 'function') {
      scope.URL.revokeObjectURL(url);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/* ---------------- 本地 Piper（离线 CPU） ---------------- */

/** 纯函数：构造 Piper /tts 请求。无需参考音频/参考文本。 */
export function buildPiperRequest({ text, apiBase = DEFAULT_PIPER_API_BASE } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { ok: false, error: '请先填写试听文本' };
  if (raw.length > PIPER_TEXT_LIMIT) {
    return { ok: false, error: `试听文本过长（${raw.length} 字）：Piper 建议 ${PIPER_TEXT_LIMIT} 字以内，请缩短后再试` };
  }
  return {
    ok: true,
    provider: 'piper',
    url: `${normalizeApiBase(apiBase, DEFAULT_PIPER_API_BASE)}/tts`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { text: raw },
    timeoutMs: 60000,
  };
}

/** Piper 错误状态 → 中文提示（引导 start-piper.bat） */
export function mapPiperError(status, detail = '') {
  if (status === 400) return `Piper 请求参数错误（400）${detail ? `：${detail}` : ''}，请缩短试听文本或检查模型`;
  if (status === 404) return 'Piper 接口不存在（404）：请确认服务地址（默认 /piper-api → 127.0.0.1:9881）';
  if (status === 503) return 'Piper 服务不可用（503）：请先双击根目录 start-piper.bat 启动离线语音服务';
  if (status === 500) return `Piper 合成失败（500）${detail ? `：${detail}` : ''}，请查看 start-piper.bat 窗口的报错`;
  return `Piper 请求失败（${status || '网络错误'}）${detail ? `：${detail}` : ''}，请确认 start-piper.bat 已启动`;
}

export function piperErrorFromException(error) {
  if (!error) return 'Piper 合成失败：未知错误';
  if (error.name === 'AbortError') return 'Piper 合成超时（60 秒）：首次加载模型可能较慢，请稍后重试';
  if (error.name === 'TypeError' || /Failed to fetch|NetworkError|network/i.test(String(error.message || ''))) {
    return '无法连接本地 Piper：请先双击根目录 start-piper.bat 启动服务（默认 127.0.0.1:9881）';
  }
  return `Piper 合成失败：${error.message || '未知错误'}`;
}

/** GET /health：检测 Piper 服务是否在线（UI 状态徽标用） */
export async function checkPiperHealth({ apiBase = DEFAULT_PIPER_API_BASE } = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { ok: false, error: '当前环境不支持网络请求' };
  const url = `${normalizeApiBase(apiBase, DEFAULT_PIPER_API_BASE)}/health`;
  try {
    const response = await fetchImpl(url, { method: 'GET' });
    if (!response || response.ok === false) {
      return { ok: false, status: response && response.status, error: mapPiperError(response && response.status) };
    }
    return { ok: true, status: response.status || 200, url };
  } catch (error) {
    return { ok: false, error: piperErrorFromException(error) };
  }
}

/**
 * 生成 Piper 离线语音，返回 {ok, audioUrl, blob}。
 * deps.fetchImpl / createObjectUrl 可注入测试；60s 超时用 AbortController。
 */
export async function generatePiperSpeech({ text, apiBase = DEFAULT_PIPER_API_BASE, timeoutMs = 60000 } = {}, deps = {}) {
  const request = buildPiperRequest({ text, apiBase });
  if (!request.ok) return { ok: false, error: request.error };
  const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { ok: false, error: '当前环境不支持网络请求' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer = null;
  if (controller) {
    timer = setTimeout(() => controller.abort(), timeoutMs || request.timeoutMs);
  }
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response || response.ok === false) {
      let detail = '';
      try {
        if (response && typeof response.text === 'function') {
          detail = String(await response.text()).slice(0, 160);
        }
      } catch {
        // ignore
      }
      return { ok: false, error: mapPiperError(response && response.status, detail) };
    }
    const blob = await response.blob();
    if (!blob || (typeof blob.size === 'number' && blob.size === 0)) {
      return { ok: false, error: 'Piper 返回空音频：请检查模型文件与 start-piper.bat 窗口' };
    }
    let audioUrl = '';
    if (typeof deps.createObjectUrl === 'function') {
      audioUrl = deps.createObjectUrl(blob);
    } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      audioUrl = URL.createObjectURL(blob);
    }
    if (!audioUrl) return { ok: false, error: '无法创建试听音频地址' };
    return { ok: true, provider: 'piper', audioUrl, blob };
  } catch (error) {
    return { ok: false, error: piperErrorFromException(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------------- 配置读写 ---------------- */

export function normalizeVoiceConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const provider = ['browser', 'gpt-sovits', 'piper'].includes(src.provider) ? src.provider : 'browser';
  return {
    provider,
    browserVoice: String(src.browserVoice || ''),
    rate: clampVoiceNumber(src.rate, 0.5, 2, 1),
    pitch: clampVoiceNumber(src.pitch, 0, 2, 1),
    apiBase: normalizeApiBase(src.apiBase, DEFAULT_VOICE_API_BASE),
    piperApiBase: normalizeApiBase(src.piperApiBase, DEFAULT_PIPER_API_BASE),
    refAudioPath: normalizeRefAudioPath(src.refAudioPath) || DEFAULT_VOICE_REF,
    promptText: String(src.promptText || DEFAULT_VOICE_PROMPT).slice(0, 120),
    speed: clampVoiceNumber(src.speed, 0.5, 2, 1),
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // SSR
  }
  return null;
}

export function readVoiceConfig(storage) {
  const store = resolveStorage(storage);
  if (!store) return { ...DEFAULT_VOICE_CONFIG };
  try {
    const raw = store.getItem(VOICE_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_VOICE_CONFIG };
    return normalizeVoiceConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VOICE_CONFIG };
  }
}

export function saveVoiceConfig(config, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(VOICE_CONFIG_KEY, JSON.stringify(normalizeVoiceConfig(config)));
    return true;
  } catch {
    return false;
  }
}

/** 默认试听文本：如「关羽，参战！」 */
export function buildDefaultVoiceText(name, skillNames = []) {
  const who = String(name || '').trim();
  const skills = (Array.isArray(skillNames) ? skillNames : []).filter(Boolean).slice(0, 3);
  if (!who) return '武将，参战！';
  if (skills.length) return `${who}，听我号令：${skills.join('、')}！`;
  return `${who}，参战！`;
}
