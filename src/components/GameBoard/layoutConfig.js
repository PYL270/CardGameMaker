/**
 * layoutConfig - 对局界面布局配置（预设 / CSS 变量 / localStorage 持久化）
 *
 * 设计目标：不改动游戏逻辑，仅用 .game-board 上的 data-layout 与 CSS 变量驱动视觉；
 * 经典式 = 加布局设置前的原布局，保证可回归。
 */

export const LAYOUT_STORAGE_KEY = 'cgm_layout';

/** 手牌缩放范围 */
export const HAND_SCALE_MIN = 0.85;
export const HAND_SCALE_MAX = 1.3;

/** 布局预设：每个预设给出全部字段的默认值，玩家可在此基础上微调 */
export const PRESET_SETTINGS = {
  mingsha: {
    preset: 'mingsha',
    theme: 'ink',
    handScale: 1.05,
    handGap: 'normal',
    opponentScale: 'normal',
    logPosition: 'right',
    logCollapsed: true,
    showBanner: true,
    showFloats: true,
    showDistance: true,
  },
  classic: {
    preset: 'classic',
    theme: 'ink',
    handScale: 1,
    handGap: 'normal',
    opponentScale: 'normal',
    logPosition: 'right',
    logCollapsed: false,
    showBanner: true,
    showFloats: true,
    showDistance: true,
  },
  compact: {
    preset: 'compact',
    theme: 'ink',
    handScale: 0.9,
    handGap: 'compact',
    opponentScale: 'small',
    logPosition: 'hidden',
    logCollapsed: true,
    showBanner: false,
    showFloats: false,
    showDistance: true,
  },
};

export const PRESETS = [
  { id: 'mingsha', name: '名将杀式', desc: '细状态条 + 紧凑对手武将卡 + 右侧收起日志（默认）' },
  { id: 'classic', name: '经典式', desc: '保留原布局：对手区换行、日志默认展开' },
  { id: 'compact', name: '紧凑式', desc: '手牌更小、日志隐藏、提示精简，适合小屏' },
];

/** 手牌间距/重叠：gap 为卡牌间隔，overlap 为卡牌重叠量（负 margin） */
export const HAND_GAP_OPTIONS = [
  { id: 'compact', name: '紧凑', gap: '4px', overlap: '-14px' },
  { id: 'normal', name: '标准', gap: '8px', overlap: '0px' },
  { id: 'loose', name: '宽松', gap: '16px', overlap: '0px' },
];

/** 对手卡尺寸：scale 用于 .other-players .player-area 的尺寸换算 */
export const OPPONENT_SCALE_OPTIONS = [
  { id: 'small', name: '小', scale: 0.83 },
  { id: 'normal', name: '标准', scale: 1 },
  { id: 'large', name: '大', scale: 1.18 },
];

export const LOG_POSITION_OPTIONS = [
  { id: 'right', name: '右侧' },
  { id: 'bottom', name: '底部' },
  { id: 'hidden', name: '隐藏' },
];

/**
 * 界面风格：只改变对局界面的材质、色彩、字体与装饰强度，
 * 不改变布局结构 / 操作流程，玩家可在布局设置中即时切换。
 */
export const THEME_OPTIONS = [
  {
    id: 'ink',
    name: '墨玉鎏金',
    short: '墨玉',
    desc: '默认风格：墨玉底、鎏金线、宣纸牌面，沉稳的东方对局感。',
    swatch: ['#0a0d13', '#d6b96e', '#f3ead6'],
  },
  {
    id: 'modern',
    name: '青灰极简',
    short: '极简',
    desc: '收敛金线与圆环，冷青灰面板、弱装饰、信息优先，接近战术 HUD。',
    swatch: ['#0d1519', '#8fb9c9', '#e7eef0'],
  },
  {
    id: 'tabletop',
    name: '暖木典藏',
    short: '典藏',
    desc: '暖木桌面、羊皮纸质感、更厚的描边与投影，桌游氛围更浓。',
    swatch: ['#1b120b', '#e3b96c', '#f3e3c4'],
  },
];

const presetIds = Object.keys(PRESET_SETTINGS);
const handGapIds = HAND_GAP_OPTIONS.map(o => o.id);
const opponentIds = OPPONENT_SCALE_OPTIONS.map(o => o.id);
const logIds = LOG_POSITION_OPTIONS.map(o => o.id);
const themeIds = THEME_OPTIONS.map(o => o.id);

/** 手牌缩放裁剪到 0.85~1.3，保留两位小数 */
export function clampHandScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(HAND_SCALE_MAX, Math.max(HAND_SCALE_MIN, n));
  return Math.round(clamped * 100) / 100;
}

export function isPresetId(id) {
  return presetIds.includes(id);
}

/** 默认布局 = 名将杀式 */
export function defaultLayout() {
  return { ...PRESET_SETTINGS.mingsha };
}

/** 取某个预设的完整默认值（返回新对象，避免调用方改到常量） */
export function applyPreset(presetId) {
  const id = isPresetId(presetId) ? presetId : 'mingsha';
  return { ...PRESET_SETTINGS[id] };
}

/**
 * 归一化任意输入（localStorage / 面板修改）为合法布局配置：
 * - 非法枚举回落到该预设默认值
 * - 手牌缩放裁剪到 0.85~1.3
 */
export function normalizeLayout(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const preset = isPresetId(raw.preset) ? raw.preset : 'mingsha';
  const base = PRESET_SETTINGS[preset];
  const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  return {
    preset,
    theme: themeIds.includes(raw.theme) ? raw.theme : base.theme,
    handScale: clampHandScale(raw.handScale === undefined ? base.handScale : raw.handScale),
    handGap: handGapIds.includes(raw.handGap) ? raw.handGap : base.handGap,
    opponentScale: opponentIds.includes(raw.opponentScale) ? raw.opponentScale : base.opponentScale,
    logPosition: logIds.includes(raw.logPosition) ? raw.logPosition : base.logPosition,
    logCollapsed: bool(raw.logCollapsed, base.logCollapsed),
    showBanner: bool(raw.showBanner, base.showBanner),
    showFloats: bool(raw.showFloats, base.showFloats),
    showDistance: bool(raw.showDistance, base.showDistance),
  };
}

/** 面板修改：保留 preset，合并补丁后归一化 */
export function updateLayout(layout, patch) {
  return normalizeLayout({ ...(layout || {}), ...(patch || {}) });
}

export function handGapOption(layout) {
  const id = normalizeLayout(layout).handGap;
  return HAND_GAP_OPTIONS.find(o => o.id === id) || HAND_GAP_OPTIONS[1];
}

export function opponentScaleOption(layout) {
  const id = normalizeLayout(layout).opponentScale;
  return OPPONENT_SCALE_OPTIONS.find(o => o.id === id) || OPPONENT_SCALE_OPTIONS[1];
}

export function themeOption(layout) {
  const id = normalizeLayout(layout).theme;
  return THEME_OPTIONS.find(o => o.id === id) || THEME_OPTIONS[0];
}

/** .game-board 的 data-* 属性 */
export function layoutData(layout) {
  const l = normalizeLayout(layout);
  return {
    'data-layout': l.preset,
    'data-theme': l.theme,
    'data-log-position': l.logPosition,
  };
}

/** 驱动布局的 CSS 变量 */
export function layoutStyle(layout) {
  const l = normalizeLayout(layout);
  const gap = handGapOption(l);
  const opp = opponentScaleOption(l);
  return {
    '--hand-scale': String(l.handScale),
    '--hand-gap': gap.gap,
    '--hand-overlap': gap.overlap,
    '--opponent-scale': String(opp.scale),
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 隐私模式 / SSR 下不可用
  }
  return null;
}

/** 读取并归一化布局；损坏/无数据时回落到默认“名将杀式” */
export function loadLayout(storage) {
  const store = resolveStorage(storage);
  if (!store) return defaultLayout();
  try {
    const raw = store.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaultLayout();
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return defaultLayout();
  }
}

/** 持久化布局（只写归一化后的字段） */
export function saveLayout(layout, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(normalizeLayout(layout)));
    return true;
  } catch {
    return false;
  }
}

/** 清除持久化（测试/恢复默认使用） */
export function clearLayout(storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.removeItem(LAYOUT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * 恢复默认布局时应放行的挂起 UI：
 * - logCollapsed=false 的预设需要展开日志
 */
export function shouldOpenLog(layout) {
  const l = normalizeLayout(layout);
  return l.logPosition !== 'hidden' && !l.logCollapsed;
}
