/**
 * audioManager - 全局音频系统
 * - 背景音乐(BGM)：内置合成氛围(menu/game) 或玩家上传的自定义音频
 * - 音效(SFX)：按钮/出牌/伤害/摸牌/回合/胜负；可替换为自定义文件
 * - 自定义音频保存在浏览器 IndexedDB（不会上传服务器，也不占项目目录）
 * - 首次用户交互后解锁自动播放
 */
import { playImpact, playTap } from '../utils/effects';
import { alertDialog } from '../utils/dialogService';
import { SFX_CATEGORIES, SFX_SLOTS, BUILTIN_SFX, getSfxTuning } from './sfxCatalog';

export { SFX_CATEGORIES, SFX_SLOTS, BUILTIN_SFX };

const CONFIG_KEY = 'cgm_audio_config';
const DB_NAME = 'cgm_audio_db';
const DB_VERSION = 1;
const STORE = 'files';
// BGM 解码缓存上限：decoded PCM 每首可达几十 MB，仅保留最近 4 首
const MAX_BGM_BUFFERS = 4;

export const BGM_SLOTS = [
  { key: 'bgm:menu', label: '主菜单背景音乐' },
  { key: 'bgm:game', label: '对局背景音乐' },
];

/** 音效分类与 CC0 采样目录统一由 sfxCatalog 提供（便于 Node 测试复用） */

const BUILTIN_BGM = {
  'builtin:shanhe': '/audio/bgm-shanhe.wav',
  'builtin:zhangu': '/audio/bgm-zhangu.wav',
  'builtin:shenyang': '/audio/bgm-shenyang.mp3',
  'builtin:ripples': '/audio/bgm-ripples.mp3',
  'builtin:guzheng': '/audio/bgm-guzheng.mp3',
};

/** 内置曲目展示信息（AudioSettings 共用） */
export const BUILTIN_BGM_OPTIONS = [
  { mode: 'builtin:shanhe', label: '山河', desc: '恢弘古风（项目自制）' },
  { mode: 'builtin:zhangu', label: '战鼓', desc: '激昂古风（项目自制）' },
  { mode: 'builtin:shenyang', label: '沈阳', desc: '二胡/琵琶 · Kevin MacLeod CC BY' },
  { mode: 'builtin:ripples', label: '涟漪', desc: '古筝 · Kevin MacLeod CC BY' },
  { mode: 'builtin:guzheng', label: '古筝城', desc: '古筝/打击 · Kevin MacLeod CC BY' },
];

const DEFAULT_CONFIG = {
  enabled: true,
  master: 0.8,
  bgm: 0.35,
  sfx: 0.7,
  slots: {
    'bgm:menu': 'builtin:shanhe',
    'bgm:game': 'builtin:zhangu',
    'sfx:click': 'builtin',
    'sfx:select': 'builtin',
    'sfx:error': 'builtin',
    'sfx:card': 'builtin',
    'sfx:draw': 'builtin',
    'sfx:shuffle': 'builtin',
    'sfx:equip': 'builtin',
    'sfx:trick': 'builtin',
    'sfx:discard': 'builtin',
    'sfx:tao': 'builtin',
    'sfx:sha': 'builtin',
    'sfx:shan': 'builtin',
    'sfx:damage': 'builtin',
    'sfx:kill': 'builtin',
    'sfx:dying': 'builtin',
    'sfx:turn': 'builtin',
    'sfx:judge': 'builtin',
    'sfx:heal': 'builtin',
    'sfx:win': 'builtin',
    'sfx:lose': 'builtin',
  },
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** MP3 解码后去掉首尾静音并做极短淡入淡出，降低循环接缝 */
function trimBufferForLoop(ctx, buffer) {
  if (!ctx || !buffer || !buffer.length) return buffer;
  const threshold = 0.0025;
  let start = 0;
  let end = buffer.length - 1;
  const channels = buffer.numberOfChannels;
  outer: for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) { start = i; break outer; }
    }
  }
  outerEnd: for (let i = buffer.length - 1; i >= 0; i--) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) { end = i; break outerEnd; }
    }
  }
  if (end <= start) return buffer;
  const pad = Math.floor(buffer.sampleRate * 0.012);
  start = Math.max(0, start - pad);
  end = Math.min(buffer.length - 1, end + pad);
  const length = end - start + 1;
  const out = ctx.createBuffer(channels, length, buffer.sampleRate);
  const fade = Math.min(Math.floor(buffer.sampleRate * 0.008), Math.floor(length / 4));
  for (let ch = 0; ch < channels; ch++) {
    const target = out.getChannelData(ch);
    target.set(buffer.getChannelData(ch).subarray(start, end + 1));
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      target[i] *= g;
      target[length - 1 - i] *= g;
    }
  }
  return out;
}

class AudioManager {
  constructor() {
    this.supported = typeof window !== 'undefined'
      && !!(window.AudioContext || window.webkitAudioContext);
    this.config = cloneDefaults();
    this.files = new Map(); // slot -> { name, type, url }
    this.listeners = new Set();
    this.ctx = null;
    this.bgmEl = null;
    this.bgmSource = null;
    this._bgmToken = 0;
    this._bufferCache = new Map();
    this._bufferPromises = new Map();
    this._sfxBufferCache = new Map();
    this._sfxPromises = new Map();
    this._preloadingSfx = false;
    this._preloadedBgm = false;
    this.synth = null;
    this.scene = 'menu';
    this.unlocked = false;
    this._lastClick = 0;
    this._loadingFiles = false;

    if (typeof window === 'undefined') return;

    this._readConfig();
    this._bindUnlock();
    this._bindButtonClicks();
    this._loadFiles();
  }

  /* ---------------- 配置 ---------------- */

  _readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const slots = { ...cloneDefaults().slots, ...(saved.slots || {}) };
      // 旧版本合成音乐模式迁移到内置古风曲目
      if (slots['bgm:menu'] === 'synth:calm') slots['bgm:menu'] = 'builtin:shanhe';
      if (slots['bgm:game'] === 'synth:battle') slots['bgm:game'] = 'builtin:zhangu';
      // 旧音效 'synth' 迁移为内置 CC0 采样（仅限有 sample 的槽位）
      for (const slot of SFX_SLOTS) {
        if (slot.sample && (slots[slot.key] === 'synth' || !slots[slot.key])) {
          slots[slot.key] = 'builtin';
        }
      }
      this.config = {
        ...cloneDefaults(),
        ...saved,
        slots,
      };
    } catch {
      // ignore
    }
  }

  _saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch {
      // ignore
    }
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  getFiles() {
    const result = {};
    for (const [slot, info] of this.files.entries()) {
      result[slot] = { name: info.name, type: info.type };
    }
    return result;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  setEnabled(enabled) {
    this.config.enabled = !!enabled;
    this._saveConfig();
    if (!this.config.enabled) this.stopBgm();
    else if (this.unlocked) this.startBgm();
    this._emit();
  }

  setVolume(key, value) {
    if (key !== 'master' && key !== 'bgm' && key !== 'sfx') return;
    this.config[key] = clamp01(value);
    this._saveConfig();
    this._applyBgmVolume();
    this._emit();
  }

  setSlotMode(slotKey, mode) {
    this.config.slots[slotKey] = mode;
    this._saveConfig();
    if (slotKey.startsWith('bgm:') && this.unlocked && this.config.enabled) {
      const current = this.scene === 'game' ? 'bgm:game' : 'bgm:menu';
      if (current === slotKey) this.startBgm();
    }
    this._emit();
  }

  /* ---------------- IndexedDB ---------------- */

  _openDb() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'slot' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async _loadFiles() {
    if (this._loadingFiles) return;
    this._loadingFiles = true;
    const db = await this._openDb();
    if (!db) { this._loadingFiles = false; return; }
    try {
      const files = await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      for (const item of files) {
        if (!item?.blob) continue;
        const url = URL.createObjectURL(item.blob);
        this.files.set(item.slot, { name: item.name || '音频', type: item.type || item.blob.type, url });
      }
      this._emit();
      if (this.unlocked) this.startBgm();
    } finally {
      this._loadingFiles = false;
    }
  }

  async importFile(slotKey, file) {
    if (!file || typeof window === 'undefined') return false;
    if (file.size > 40 * 1024 * 1024) {
      await alertDialog({ title: '音频文件过大', message: '音频文件过大（上限 40MB）', danger: true });
      return false;
    }
    const db = await this._openDb();
    if (!db) {
      await alertDialog({ title: '无法保存音频', message: '当前浏览器不支持本地音频存储', danger: true });
      return false;
    }
    const old = this.files.get(slotKey);
    if (old) URL.revokeObjectURL(old.url);
    const url = URL.createObjectURL(file);
    this.files.set(slotKey, { name: file.name, type: file.type || 'audio', url });
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({
          slot: slotKey,
          name: file.name,
          type: file.type || 'audio',
          blob: file,
        });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch {
      // 即使数据库写入失败也保留当前会话的 URL
    }
    this.config.slots[slotKey] = 'custom';
    this._saveConfig();
    if (slotKey.startsWith('bgm:') && this.unlocked && this.config.enabled) {
      const current = this.scene === 'game' ? 'bgm:game' : 'bgm:menu';
      if (current === slotKey) this.startBgm();
    }
    this._emit();
    return true;
  }

  async removeFile(slotKey) {
    const old = this.files.get(slotKey);
    if (old) URL.revokeObjectURL(old.url);
    this.files.delete(slotKey);
    const sfxSlot = SFX_SLOTS.find(slot => slot.key === slotKey);
    this.config.slots[slotKey] = slotKey.startsWith('bgm:')
      ? (slotKey === 'bgm:game' ? 'builtin:zhangu' : 'builtin:shanhe')
      : (sfxSlot?.sample ? 'builtin' : 'synth');
    this._saveConfig();
    const db = await this._openDb();
    if (db) {
      try {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(slotKey);
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      } catch {
        // ignore
      }
    }
    if (slotKey.startsWith('bgm:') && this.unlocked && this.config.enabled) {
      const current = this.scene === 'game' ? 'bgm:game' : 'bgm:menu';
      if (current === slotKey) this.startBgm();
    }
    this._emit();
  }

  /* ---------------- 解锁与全局点击音效 ---------------- */

  _bindUnlock() {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this._ensureCtx();
      if (this.config.enabled) {
        this.startBgm();
        this._preloadBgmBuffers();
        this._preloadSfxSamples();
      }
    };
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  _bindButtonClicks() {
    if (typeof document === 'undefined') return;
    document.addEventListener('pointerdown', (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const btn = target.closest('button, .btn');
      if (!btn || btn.disabled || btn.dataset?.noSfx === '1') return;
      const now = Date.now();
      if (now - this._lastClick < 60) return;
      this._lastClick = now;
      this.playSfx('click');
    }, true);
  }

  /* ---------------- AudioContext / BGM ---------------- */

  _ensureCtx() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      try { this.ctx = new AC(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _bgmGain() {
    return clamp01(this.config.master) * clamp01(this.config.bgm);
  }

  _applyBgmVolume() {
    if (this.bgmEl) {
      this.bgmEl.volume = clamp01(this.config.master) * clamp01(this.config.bgm);
    }
    if (this.bgmSource?.gain && this.ctx) {
      try {
        this.bgmSource.gain.gain.setTargetAtTime(this._bgmGain(), this.ctx.currentTime, 0.15);
      } catch {
        // ignore
      }
    }
    if (this.synth?.master) {
      try {
        this.synth.master.gain.setTargetAtTime(this._bgmGain() * 0.5, this.ctx.currentTime, 0.2);
      } catch {
        // ignore
      }
    }
  }

  setScene(scene) {
    const next = scene === 'game' ? 'game' : 'menu';
    // 同一场景切换页面（如菜单→音频设置）不要重播 BGM，避免循环被重置
    if (next === this.scene && (this.bgmSource || this.bgmEl || this.synth)) return;
    this.scene = next;
    if (this.unlocked && this.config.enabled) this.startBgm();
  }

  startBgm() {
    if (typeof window === 'undefined' || !this.config.enabled) return;
    const slotKey = this.scene === 'game' ? 'bgm:game' : 'bgm:menu';
    const mode = this.config.slots[slotKey];
    this.stopBgm();

    if (mode === 'off') return;

    const preset = (mode === 'battle' || mode === 'synth:battle') ? 'battle' : 'calm';

    let url = null;
    if (mode === 'custom') {
      url = this.files.get(slotKey)?.url || null;
    } else {
      url = BUILTIN_BGM[mode]
        || (mode === 'synth:calm' ? BUILTIN_BGM['builtin:shanhe'] : null)
        || (mode === 'synth:battle' ? BUILTIN_BGM['builtin:zhangu'] : null);
    }

    if (!url) {
      this._startSynth(preset);
      return;
    }

    // 采样级无缝循环：解码成 AudioBuffer 后用 AudioBufferSourceNode loop
    const token = ++this._bgmToken;
    this._startBufferedBgm(url, token, preset);
  }

  async _startBufferedBgm(url, token, preset) {
    const ctx = this._ensureCtx();
    if (!ctx) {
      if (token === this._bgmToken) this._playBgmElement(url, preset);
      return;
    }
    try {
      const buffer = await this._loadBuffer(url, ctx);
      if (token !== this._bgmToken || !this.config.enabled) return;
      this._playBuffer(buffer);
    } catch (err) {
      console.warn('[audio] 无法解码 BGM，回退到 <audio> 循环', err);
      if (token === this._bgmToken) this._playBgmElement(url, preset);
    }
  }

  /** 加载并解码音频（带缓存与并发去重；LRU 上限防止解码后的 PCM 撑爆内存） */
  async _loadBuffer(url, ctx) {
    if (this._bufferCache.has(url)) {
      const cached = this._bufferCache.get(url);
      // LRU：重新插入刷新淘汰顺序
      this._bufferCache.delete(url);
      this._bufferCache.set(url, cached);
      return cached;
    }
    if (this._bufferPromises.has(url)) return this._bufferPromises.get(url);
    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`BGM 加载失败: ${res.status}`);
      const raw = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(raw.slice(0));
      const buffer = /\.mp3(\?|$)/i.test(url) ? trimBufferForLoop(ctx, decoded) : decoded;
      this._bufferCache.set(url, buffer);
      // 解码后 PCM 每首可达几十 MB，只保留最近几首
      while (this._bufferCache.size > MAX_BGM_BUFFERS) {
        const oldest = this._bufferCache.keys().next().value;
        if (oldest === undefined || oldest === url) break;
        this._bufferCache.delete(oldest);
      }
      return buffer;
    })();
    this._bufferPromises.set(url, promise);
    try {
      return await promise;
    } finally {
      this._bufferPromises.delete(url);
    }
  }

  /** 首次交互后预热常用曲目，切场景时立即播放（不一次性解码全部大文件） */
  _preloadBgmBuffers() {
    if (this._preloadedBgm) return;
    this._preloadedBgm = true;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const urls = new Set([BUILTIN_BGM['builtin:shanhe'], BUILTIN_BGM['builtin:zhangu']]);
    const slotKey = this.scene === 'game' ? 'bgm:game' : 'bgm:menu';
    const current = BUILTIN_BGM[this.config.slots[slotKey]];
    if (current) urls.add(current);
    for (const url of urls) {
      if (url && !this._bufferCache.has(url)) {
        this._loadBuffer(url, ctx).catch(() => {});
      }
    }
  }

  _playBuffer(buffer) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = buffer.duration;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this._bgmGain(), now + 0.8);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      this.bgmSource = { src, gain, startedAt: now };
    } catch (err) {
      console.warn('[audio] BGM 播放失败', err);
    }
  }

  /** 回退方案：<audio loop>（部分浏览器循环处可能有极小间隙） */
  /** 播放循环 BGM 元素；自动播放被拦截时等待下一次点击 */
  _playBgmElement(url, fallbackPreset = 'calm') {
    if (typeof Audio === 'undefined') return false;
    try {
      const el = new Audio(url);
      el.loop = true;
      el.preload = 'auto';
      el.volume = clamp01(this.config.master) * clamp01(this.config.bgm);
      this.bgmEl = el;
      el.addEventListener('error', () => {
        if (this.bgmEl === el) {
          this.bgmEl = null;
          this._startSynth(fallbackPreset);
        }
      }, { once: true });
      el.play().catch(() => {
        const retry = () => {
          if (this.bgmEl === el) el.play().catch(() => {});
          document.removeEventListener('pointerdown', retry, true);
        };
        document.addEventListener('pointerdown', retry, true);
      });
      return true;
    } catch {
      return false;
    }
  }

  _startSynth(preset) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const chords = preset === 'battle'
      ? [110.00, 98.00, 130.81, 116.54]
      : [82.41, 73.42, 98.00, 87.31];
    const ratios = [1, 1.5, 2, 2.997];
    const oscs = [];
    const gains = [];
    const nodes = [];

    for (let i = 0; i < ratios.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = chords[0] * ratios[i];
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset === 'battle' ? 950 : 620;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start(now);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.017;
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start(now);
      oscs.push(osc);
      gains.push(g);
      nodes.push(osc, lfo);
    }

    master.gain.setTargetAtTime(this._bgmGain(), now, 2.5);
    gains.forEach(g => g.gain.setTargetAtTime(preset === 'battle' ? 0.05 : 0.06, now, 2.5));

    let chordIndex = 0;
    const timer = setInterval(() => {
      if (!this.synth) return;
      chordIndex = (chordIndex + 1) % chords.length;
      const base = chords[chordIndex];
      oscs.forEach((osc, i) => {
        try {
          osc.frequency.setTargetAtTime(base * ratios[i], ctx.currentTime, 2.2);
        } catch {
          // ignore
        }
      });
    }, 8000);

    this.synth = { ctx, master, nodes, timer };
  }

  stopBgm() {
    this._bgmToken++;
    if (this.bgmSource) {
      const { src, gain } = this.bgmSource;
      this.bgmSource = null;
      try {
        const now = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.12);
        setTimeout(() => {
          try { src.stop(); } catch { /* ignore */ }
          try { gain.disconnect(); } catch { /* ignore */ }
        }, 350);
      } catch {
        // ignore
      }
    }
    if (this.bgmEl) {
      try {
        this.bgmEl.pause();
        this.bgmEl.currentTime = 0;
      } catch { /* ignore */ }
      this.bgmEl = null;
    }
    if (this.synth) {
      const { ctx, master, nodes, timer } = this.synth;
      this.synth = null;
      clearInterval(timer);
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => {
          nodes.forEach(node => {
            try { node.stop(); } catch { /* ignore */ }
          });
          try { master.disconnect(); } catch { /* ignore */ }
        }, 700);
      } catch {
        // ignore
      }
    }
  }

  /* ---------------- 音效 ---------------- */

  /** 预加载全部内置 CC0 音效：并发最多 4，失败静默（点击时仍会重试/合成兜底） */
  async _preloadSfxSamples(concurrency = 4) {
    if (this._preloadingSfx || typeof window === 'undefined') return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    this._preloadingSfx = true;
    try {
      const urls = [...new Set(SFX_SLOTS.map(slot => slot.sample).filter(Boolean))];
      let index = 0;
      const worker = async () => {
        while (index < urls.length) {
          const url = urls[index];
          index += 1;
          if (this._sfxBufferCache.has(url)) continue;
          if (this._sfxPromises.has(url)) continue;
          const promise = this._fetchSfxSample(ctx, url);
          this._sfxPromises.set(url, promise);
          try {
            const buffer = await promise;
            this._sfxBufferCache.set(url, buffer);
          } catch {
            // 预加载失败静默，播放时回退合成
          } finally {
            this._sfxPromises.delete(url);
          }
        }
      };
      const workers = Array.from({ length: Math.min(concurrency, urls.length) }, worker);
      await Promise.all(workers);
    } finally {
      this._preloadingSfx = false;
    }
  }

  async _fetchSfxSample(ctx, url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response || response.ok === false) {
      throw new Error(`加载音效失败：${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('音效文件为空');
    return ctx.decodeAudioData(arrayBuffer);
  }

  _playBufferSfx(buffer, volume, slotKey = '') {
    const ctx = this._ensureCtx();
    if (!ctx || !buffer) return false;
    const tune = getSfxTuning(slotKey);
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.97 + Math.random() * 0.06;
      const gain = ctx.createGain();
      const level = Math.min(1, clamp01(volume) * clamp01(tune.gain || 1));
      gain.gain.value = level;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      // 按动画/交互时长截断并淡出，避免洗牌等长采样拖尾
      if (tune.maxDuration > 0) {
        const wall = tune.maxDuration;
        const natural = buffer.duration / source.playbackRate.value;
        if (wall < natural - 0.02) {
          const end = ctx.currentTime + wall;
          const fade = Math.min(0.045, wall * 0.25);
          gain.gain.setValueAtTime(level, Math.max(ctx.currentTime, end - fade));
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          source.stop(end + 0.012);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /** 播放内置采样：缓存命中立即播；未命中则 fetch+decode，失败自动回退合成音 */
  _playSampleSfx(slotKey, volume) {
    const slot = SFX_SLOTS.find(item => item.key === slotKey);
    if (!slot?.sample) return false;
    const ctx = this._ensureCtx();
    if (!ctx) return false;
    const cached = this._sfxBufferCache.get(slot.sample);
    if (cached) {
      this._playBufferSfx(cached, volume, slotKey);
      return true;
    }
    const pending = this._sfxPromises.get(slot.sample);
    if (pending) {
      pending.then(buffer => {
        if (buffer) this._playBufferSfx(buffer, volume, slotKey);
      }).catch(() => {});
      return true;
    }
    const promise = this._fetchSfxSample(ctx, slot.sample);
    this._sfxPromises.set(slot.sample, promise);
    promise.then(buffer => {
      this._sfxBufferCache.set(slot.sample, buffer);
      this._sfxPromises.delete(slot.sample);
      this._playBufferSfx(buffer, volume, slotKey);
    }).catch(() => {
      this._sfxPromises.delete(slot.sample);
      // 采样加载失败：回退到原有合成音，保证可听
      this._playSynthSfx(slotKey.replace(/^sfx:/, ''));
    });
    return true;
  }

  playSfx(name) {
    if (typeof window === 'undefined' || !this.config.enabled) return;
    const slotKey = `sfx:${name}`;
    const volume = clamp01(this.config.master) * clamp01(this.config.sfx);
    const file = this.files.get(slotKey);
    if (this.config.slots[slotKey] === 'custom' && file?.url) {
      try {
        const el = new Audio(file.url);
        el.volume = Math.min(1, volume);
        el.play().catch(() => {});
        return;
      } catch {
        // fallback
      }
    }
    const slot = SFX_SLOTS.find(item => item.key === slotKey);
    if (slot?.sample && this.config.slots[slotKey] !== 'synth') {
      if (this._playSampleSfx(slotKey, volume)) return;
    }
    this._playSynthSfx(name);
  }

  _playSynthSfx(name) {
    if (typeof window === 'undefined' || !this.config.enabled) return;
    const slotKey = `sfx:${name}`;
    const volume = clamp01(this.config.master) * clamp01(this.config.sfx);
    const file = this.files.get(slotKey);
    if (this.config.slots[slotKey] === 'custom' && file?.url) {
      try {
        const el = new Audio(file.url);
        el.volume = Math.min(1, volume);
        el.play().catch(() => {});
        return;
      } catch {
        // fallback
      }
    }

    // 整理手牌：短促纸牌滑动（白噪声脉冲 + 带通扫频 + 轻微摩擦滑音）
    if (name === 'shuffle') {
      const ctx = this._ensureCtx();
      if (!ctx) return; // 音频未解锁时静默失败
      try {
        const now = ctx.currentTime;
        const dur = 0.24;
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const decay = Math.pow(1 - i / data.length, 2.1);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.Q.value = 0.9;
        bandpass.frequency.setValueAtTime(1400, now);
        bandpass.frequency.exponentialRampToValueAtTime(4200, now + 0.07);
        bandpass.frequency.exponentialRampToValueAtTime(900, now + dur);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.12 * volume, now + 0.015);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        noise.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + dur + 0.02);

        // 纸牌错开的轻微“唰”滑音
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.17);
        oscGain.gain.setValueAtTime(0.0001, now);
        oscGain.gain.exponentialRampToValueAtTime(0.028 * volume, now + 0.02);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } catch {
        // ignore
      }
      return;
    }
    // 处决 / 濒死 / 判定 / 回复：合成演出音效
    if (name === 'kill' || name === 'dying' || name === 'judge' || name === 'heal') {
      const ctx = this._ensureCtx();
      if (!ctx) return; // 音频未解锁时静默
      try {
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        if (name === 'kill') {
          // 低频冲击 + 金属刀风 + 短噪声
          const osc = ctx.createOscillator();
          const og = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(38, now + 0.5);
          og.gain.setValueAtTime(0.0001, now);
          og.gain.exponentialRampToValueAtTime(0.34 * volume, now + 0.015);
          og.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
          osc.connect(og); og.connect(master);
          osc.start(now); osc.stop(now + 0.62);

          const dur = 0.45;
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.4);
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.setValueAtTime(2600, now);
          hp.frequency.exponentialRampToValueAtTime(900, now + dur);
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(0.0001, now);
          ng.gain.exponentialRampToValueAtTime(0.16 * volume, now + 0.012);
          ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
          noise.connect(hp); hp.connect(ng); ng.connect(master);
          noise.start(now); noise.stop(now + dur + 0.02);
        } else if (name === 'dying') {
          // 低沉双心跳
          [0, 0.32].forEach((offset, idx) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            const t = now + offset;
            osc.frequency.setValueAtTime(68, t);
            osc.frequency.exponentialRampToValueAtTime(44, t + 0.18);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime((idx === 0 ? 0.22 : 0.16) * volume, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
            osc.connect(g); g.connect(master);
            osc.start(t); osc.stop(t + 0.26);
          });
        } else if (name === 'judge') {
          // 判定揭示：两声清脆木牌翻面
          [0, 0.1].forEach((offset, idx) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = idx === 0 ? 'triangle' : 'square';
            osc.frequency.value = idx === 0 ? 1480 : 980;
            const t = now + offset;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.09 * volume, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            osc.connect(g); g.connect(master);
            osc.start(t); osc.stop(t + 0.14);
          });
        } else {
          // 回复：柔和上行三音
          [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = now + i * 0.09;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.08 * volume, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
            osc.connect(g); g.connect(master);
            osc.start(t); osc.stop(t + 0.34);
          });
        }
      } catch {
        // ignore
      }
      return;
    }
    if (name === 'damage') {
      playImpact(1);
      return;
    }
    if (name === 'sha') {
      playImpact(1.15);
      return;
    }
    if (name === 'card' || name === 'click' || name === 'draw') {
      playTap();
      return;
    }
    // 回合/胜负/桃/锦囊/装备/闪：简单合成提示音
    const ctx = this._ensureCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const toneMap = {
        win: [523.25, 659.25, 783.99],
        lose: [392.00, 329.63, 261.63],
        turn: [440.00, 554.37],
        tao: [659.25, 880.00],
        trick: [440.00, 554.37, 659.25],
        equip: [1046.50, 783.99],
        shan: [880.00, 1174.66],
      };
      const notes = toneMap[name] || [660.00];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.12;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.08 * volume, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch {
      // ignore
    }
  }

  previewSfx(name) {
    this.playSfx(name);
  }

  previewBgm(slotKey) {
    const file = this.files.get(slotKey);
    if (!file?.url) return false;
    try {
      const el = new Audio(file.url);
      el.volume = clamp01(this.config.master) * clamp01(this.config.bgm);
      el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

export const audio = new AudioManager();

// 调试/诊断入口（不影响游戏逻辑）
if (typeof window !== 'undefined') {
  window.__cgmAudio = audio;
}
