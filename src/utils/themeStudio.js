/**
 * 主题工坊 2.0：墨玉鎏金的可持久化外观层。
 *
 * - 只写 html[data-theme-studio] / data-studio-* 与三个 CSS 变量，不碰现有三套 data-theme 的布局；
 * - 所有读写都做防御性归一化，隐私模式/损坏存储/非法主题码安全回退；
 * - 主题码格式 CGM-THEME-1:<base64 JSON>，可复制给其他玩家导入。
 */

export const THEME_STORAGE_KEY = 'cgm_theme_studio';
export const THEME_CODE_PREFIX = 'CGM-THEME-1:';

export const THEME_DEFAULTS = Object.freeze({
  enabled: false,
  accent: '#d6b96e',
  accent2: '#f0d894',
  table: 'ink',
  cardBack: 'gold',
  border: 'hairline',
  font: 'serif',
});

export const THEME_TABLE_OPTIONS = Object.freeze([
  { id: 'ink', name: '墨玉', desc: '默认深墨牌桌，金色罗盘' },
  { id: 'wood', name: '老木', desc: '暖褐木纹，适合夜战' },
  { id: 'stone', name: '青石', desc: '冷灰石面，沉静克制' },
  { id: 'jade', name: '青玉', desc: '幽青玉色，衬金色文字' },
]);

export const THEME_CARD_BACK_OPTIONS = Object.freeze([
  { id: 'gold', name: '鎏金回纹', desc: '默认金色回纹牌背' },
  { id: 'ink', name: '墨玉暗纹', desc: '深墨底 + 暗金线' },
  { id: 'cloud', name: '流云', desc: '灰蓝云纹，层次更轻' },
  { id: 'dragon', name: '蟠龙', desc: '龙鳞菱格 + 金线' },
]);

export const THEME_BORDER_OPTIONS = Object.freeze([
  { id: 'hairline', name: '细金边', desc: '克制的一线金边' },
  { id: 'double', name: '双线框', desc: '宣纸牌面双层描边' },
  { id: 'none', name: '无边框', desc: '只留阴影与纸张边缘' },
]);

export const THEME_FONT_OPTIONS = Object.freeze([
  { id: 'serif', name: '宋体', desc: '正文与标题保持书卷气' },
  { id: 'sans', name: '黑体', desc: '更清晰的现代界面' },
  { id: 'calligraphy', name: '书法', desc: '标题使用毛笔字形' },
]);

const TABLE_IDS = THEME_TABLE_OPTIONS.map(o => o.id);
const CARD_BACK_IDS = THEME_CARD_BACK_OPTIONS.map(o => o.id);
const BORDER_IDS = THEME_BORDER_OPTIONS.map(o => o.id);
const FONT_IDS = THEME_FONT_OPTIONS.map(o => o.id);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

export function normalizeThemeColor(value, fallback = THEME_DEFAULTS.accent) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  if (HEX_RE.test(text)) return text.toLowerCase();
  // 容错：接受 3 位简写（#abc → #aabbcc）
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
  }
  return fallback;
}

/** 任意输入 → 完整主题对象（永不抛错） */
export function normalizeThemeStudio(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    enabled: raw.enabled === true,
    accent: normalizeThemeColor(raw.accent, THEME_DEFAULTS.accent),
    accent2: normalizeThemeColor(raw.accent2, THEME_DEFAULTS.accent2),
    table: oneOf(raw.table, TABLE_IDS, THEME_DEFAULTS.table),
    cardBack: oneOf(raw.cardBack, CARD_BACK_IDS, THEME_DEFAULTS.cardBack),
    border: oneOf(raw.border, BORDER_IDS, THEME_DEFAULTS.border),
    font: oneOf(raw.font, FONT_IDS, THEME_DEFAULTS.font),
  };
}

/** 读取本机主题；不可用/损坏时回退默认（enabled:false） */
export function loadThemeStudio(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return normalizeThemeStudio(THEME_DEFAULTS);
    const raw = store.getItem(THEME_STORAGE_KEY);
    if (!raw) return normalizeThemeStudio(THEME_DEFAULTS);
    return normalizeThemeStudio(JSON.parse(raw));
  } catch {
    return normalizeThemeStudio(THEME_DEFAULTS);
  }
}

/** 保存主题；失败不阻塞界面 */
export function saveThemeStudio(theme, storage = null) {
  const normalized = normalizeThemeStudio(theme);
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) store.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 隐私模式/配额不足：界面继续生效，仅本次不持久化
  }
  return normalized;
}

/**
 * 把主题写到 <html>：data 属性供 CSS 选择，CSS 变量供动态主色。
 * SSR/无 document 环境返回归一化结果，不抛错。
 */
export function applyThemeStudio(theme, doc = null) {
  const normalized = normalizeThemeStudio(theme);
  const target = doc || (typeof document !== 'undefined' ? document : null);
  const root = target?.documentElement;
  if (!root) return normalized;

  root.setAttribute('data-theme-studio', normalized.enabled ? 'on' : 'off');
  root.setAttribute('data-studio-table', normalized.table);
  root.setAttribute('data-studio-card-back', normalized.cardBack);
  root.setAttribute('data-studio-border', normalized.border);
  root.setAttribute('data-studio-font', normalized.font);
  root.style.setProperty('--studio-accent', normalized.accent);
  root.style.setProperty('--studio-accent-2', normalized.accent2);
  // 10% 透明度的主色，供描边/底纹轻量使用
  root.style.setProperty('--studio-accent-soft', `${normalized.accent}26`);
  return normalized;
}

function toBase64(text) {
  try {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(text)));
    }
  } catch {
    // fall through
  }
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
  } catch {
    // ignore
  }
  return '';
}

function fromBase64(code) {
  const text = String(code || '');
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(text)));
    }
  } catch {
    // fall through
  }
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(text, 'base64').toString('utf8');
  } catch {
    // ignore
  }
  return '';
}

/** 主题 → CGM-THEME-1:<base64 JSON>（分享码默认启用主题） */
export function encodeThemeCode(theme) {
  const normalized = { ...normalizeThemeStudio(theme), enabled: true };
  const payload = JSON.stringify(normalized);
  const base64 = toBase64(payload);
  return base64 ? `${THEME_CODE_PREFIX}${base64}` : '';
}

/** 主题码 → 主题；支持带/不带前缀、夹带空白、URL-safe base64；失败返回 null */
export function decodeThemeCode(code) {
  if (typeof code !== 'string') return null;
  let text = code.trim().replace(/\s+/g, '');
  if (!text) return null;
  if (text.startsWith(THEME_CODE_PREFIX)) {
    text = text.slice(THEME_CODE_PREFIX.length);
  } else {
    const prefixIndex = text.indexOf(THEME_CODE_PREFIX);
    if (prefixIndex >= 0) text = text.slice(prefixIndex + THEME_CODE_PREFIX.length);
  }
  text = text.replace(/-/g, '+').replace(/_/g, '/');
  while (text.length % 4 !== 0) text += '=';
  const json = fromBase64(text);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeThemeStudio({ ...parsed, enabled: true });
  } catch {
    return null;
  }
}

/** 主题选项展示名（未知值回退默认） */
export function themeOptionLabel(group, value) {
  const lists = {
    table: THEME_TABLE_OPTIONS,
    cardBack: THEME_CARD_BACK_OPTIONS,
    border: THEME_BORDER_OPTIONS,
    font: THEME_FONT_OPTIONS,
  };
  const list = lists[group] || [];
  return list.find(option => option.id === value)?.name || '';
}
