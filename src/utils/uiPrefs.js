/**
 * 界面增强偏好（只影响观感，不改游戏规则）
 * ------------------------------------------------------------------
 * 默认不强制改变所有观感：玩家在「设置 → 界面增强」里逐项开关，
 * 选择结果保存到 localStorage，下次打开仍然生效。
 */

export const UI_PREFS_KEY = 'cgm_ui_prefs';

export const UI_PREF_ITEMS = [
  {
    key: 'richCards',
    label: '角色卡信息强化',
    hint: '体力额外显示数值、卡框鎏金描边，装备槽更醒目',
    fallback: true,
  },
  {
    key: 'tableCarving',
    label: '桌面雕纹',
    hint: '中央牌桌增加石雕团纹、罗盘浮雕与更深的桌面层次',
    fallback: false,
  },
  {
    key: 'bigHud',
    label: '顶部大字读数',
    hint: '回合、牌堆与当前阶段放大为主读数，其余信息保持次要',
    fallback: true,
  },
];

export const DEFAULT_UI_PREFS = UI_PREF_ITEMS.reduce((acc, item) => {
  acc[item.key] = item.fallback;
  return acc;
}, {});

export function normalizeUiPrefs(raw) {
  const result = { ...DEFAULT_UI_PREFS };
  if (!raw || typeof raw !== 'object') return result;
  for (const item of UI_PREF_ITEMS) {
    if (typeof raw[item.key] === 'boolean') result[item.key] = raw[item.key];
  }
  return result;
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readUiPrefs(storage) {
  const store = resolveStorage(storage);
  if (!store) return { ...DEFAULT_UI_PREFS };
  try {
    const raw = store.getItem(UI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    return normalizeUiPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function saveUiPrefs(prefs, storage) {
  const store = resolveStorage(storage);
  const normalized = normalizeUiPrefs(prefs);
  if (!store) return normalized;
  try {
    store.setItem(UI_PREFS_KEY, JSON.stringify(normalized));
  } catch {
    // 隐私模式等写入失败时静默，当前页面仍按本次选择生效
  }
  return normalized;
}

/** 把偏好转成 data 属性，挂到 <html> 上，由 CSS 决定具体表现 */
export function uiPrefAttrs(prefs) {
  const p = normalizeUiPrefs(prefs);
  return {
    'data-rich-cards': p.richCards ? 'on' : 'off',
    'data-table-carving': p.tableCarving ? 'on' : 'off',
    'data-big-hud': p.bigHud ? 'on' : 'off',
  };
}

/** 立即把偏好写到 documentElement（设置页/对局页共用） */
export function applyUiPrefs(prefs) {
  if (typeof document === 'undefined') return;
  const attrs = uiPrefAttrs(prefs);
  Object.entries(attrs).forEach(([key, value]) => {
    document.documentElement.setAttribute(key, value);
  });
}
