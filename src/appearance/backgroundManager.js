/**
 * backgroundManager - 对战背景管理
 * - 内置动态预设：墨玉流云 / 山河云海 / 战火余烬 / 星夜流光
 * - 支持玩家上传自定义背景图（IndexedDB 本地保存，不上传服务器）
 * - 可调节暗化、模糊、动效开关
 */
const CONFIG_KEY = 'cgm_bg_config';
const DB_NAME = 'cgm_visual_db';
const DB_VERSION = 1;
const STORE = 'files';
const IMAGE_KEY = 'battle-bg';

export const BG_PRESETS = [
  {
    id: 'ink',
    name: '墨玉流云',
    desc: '默认 · 深墨底色，金色流云缓慢移动',
    colors: ['#0a0d13', '#1a2233', '#3b2c1c'],
  },
  {
    id: 'shanhe',
    name: '山河云海',
    desc: '青蓝山雾与云海，适合国风对局',
    colors: ['#071018', '#12303a', '#254a4a'],
  },
  {
    id: 'zhangu',
    name: '战火余烬',
    desc: '暗红余烬与火星上浮，紧张激烈',
    colors: ['#0d0807', '#331512', '#5a2a16'],
  },
  {
    id: 'xingye',
    name: '星夜流光',
    desc: '深蓝星夜与缓慢光带，安静辽阔',
    colors: ['#070a18', '#121c3d', '#2a2350'],
  },
  {
    id: 'custom',
    name: '自定义背景',
    desc: '上传自己的图片，可调暗化/模糊/动效',
    colors: ['#111', '#333', '#555'],
  },
];

const DEFAULT_CONFIG = {
  preset: 'ink',
  dim: 0.5,
  blur: 0,
  motion: true,
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

class BackgroundManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.imageUrl = null;
    this.fileInfo = null;
    this.listeners = new Set();
    this._loading = false;
    if (typeof window === 'undefined') return;
    this._readConfig();
    this._loadImage();
  }

  _readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.config = {
        ...DEFAULT_CONFIG,
        ...saved,
        dim: clamp(saved.dim ?? DEFAULT_CONFIG.dim, 0, 0.9),
        blur: clamp(saved.blur ?? 0, 0, 16),
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
    return { ...this.config };
  }

  getImageUrl() {
    return this.imageUrl;
  }

  getFileInfo() {
    return this.fileInfo ? { ...this.fileInfo } : null;
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

  setPreset(preset) {
    if (!BG_PRESETS.some(p => p.id === preset)) return;
    if (preset === 'custom' && !this.imageUrl) return;
    this.config.preset = preset;
    this._saveConfig();
    this._emit();
  }

  setDim(v) {
    this.config.dim = clamp(v, 0, 0.9);
    this._saveConfig();
    this._emit();
  }

  setBlur(v) {
    this.config.blur = clamp(v, 0, 16);
    this._saveConfig();
    this._emit();
  }

  setMotion(on) {
    this.config.motion = !!on;
    this._saveConfig();
    this._emit();
  }

  _openDb() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async _loadImage() {
    if (this._loading) return;
    this._loading = true;
    try {
      const db = await this._openDb();
      if (!db) return;
      const item = await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(IMAGE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!item?.blob) {
        if (this.config.preset === 'custom') {
          this.config.preset = 'ink';
          this._saveConfig();
          this._emit();
        }
        return;
      }
      this.imageUrl = URL.createObjectURL(item.blob);
      this.fileInfo = { name: item.name || '自定义背景', type: item.type || item.blob.type };
      if (!this.config.preset || this.config.preset === 'custom') {
        this.config.preset = 'custom';
      }
      this._emit();
    } finally {
      this._loading = false;
    }
  }

  async importImage(file) {
    if (!file || typeof window === 'undefined') return false;
    if (!/^image\//.test(file.type)) {
      window.alert('请选择图片文件（jpg / png / webp）');
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      window.alert('图片过大（上限 20MB）');
      return false;
    }
    const db = await this._openDb();
    if (!db) {
      window.alert('当前浏览器不支持本地图片存储');
      return false;
    }
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = URL.createObjectURL(file);
    this.fileInfo = { name: file.name, type: file.type };
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({
          key: IMAGE_KEY,
          name: file.name,
          type: file.type,
          blob: file,
        });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch {
      // ignore
    }
    this.config.preset = 'custom';
    this._saveConfig();
    this._emit();
    return true;
  }

  async removeImage() {
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = null;
    this.fileInfo = null;
    if (this.config.preset === 'custom') this.config.preset = 'ink';
    this._saveConfig();
    const db = await this._openDb();
    if (db) {
      try {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(IMAGE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      } catch {
        // ignore
      }
    }
    this._emit();
  }
}

export const background = new BackgroundManager();

if (typeof window !== 'undefined') {
  window.__cgmBackground = background;
}
