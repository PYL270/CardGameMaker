/**
 * 武将 · 卡牌工坊 —— 纯函数模型层
 * 负责：表单归一化、桌面 card-editor JSON / 游戏 Character JSON 映射、技能同名匹配、
 * 保存/导出配置、草稿读写。组件只负责渲染与副作用。
 */
import { GROUPS, GROUP_NAMES, SEX } from '../../core/Character';
import { isSafeImageUrl } from '../../ai/artProviders';

export const CHARACTER_DRAFT_KEY = 'cgm_character_draft_v2';

export const SEX_LABEL = { male: '男', female: '女', other: '其他' };

export const GROUP_OPTIONS = [
  { id: GROUPS.WEI, label: GROUP_NAMES.wei },
  { id: GROUPS.SHU, label: GROUP_NAMES.shu },
  { id: GROUPS.WU, label: GROUP_NAMES.wu },
  { id: GROUPS.QUN, label: GROUP_NAMES.qun },
  { id: GROUPS.JIN, label: GROUP_NAMES.jin },
  { id: GROUPS.SHEN, label: GROUP_NAMES.shen },
  { id: GROUPS.CUSTOM, label: GROUP_NAMES.custom },
];

export const WORKSHOP_FRAMES = [
  { id: 'gold', label: '鎏金' },
  { id: 'jade', label: '青玉' },
  { id: 'copper', label: '赤铜' },
];

export const WORKSHOP_ACCENTS = [
  { id: 'cinnabar', color: '#a83a32', label: '朱砂' },
  { id: 'jade', color: '#5f8f7d', label: '青玉' },
  { id: 'purple', color: '#8a6db0', label: '紫夜' },
  { id: 'gold', color: '#c9a757', label: '鎏金' },
  { id: 'blue', color: '#5b7fa8', label: '靛青' },
];

const FACTION_ALIASES = {
  wei: GROUPS.WEI, shu: GROUPS.SHU, wu: GROUPS.WU, qun: GROUPS.QUN,
  jin: GROUPS.JIN, shen: GROUPS.SHEN, custom: GROUPS.CUSTOM,
  魏: GROUPS.WEI, 蜀: GROUPS.SHU, 吴: GROUPS.WU, 群: GROUPS.QUN,
  晋: GROUPS.JIN, 神: GROUPS.SHEN, 自定义: GROUPS.CUSTOM,
};

const GROUP_IDS = new Set(Object.values(GROUPS));
const SEX_IDS = new Set(Object.values(SEX));

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeGroup(value, fallback = GROUPS.CUSTOM) {
  const text = String(value || '').trim();
  if (GROUP_IDS.has(text)) return text;
  return FACTION_ALIASES[text.toLowerCase()] || FACTION_ALIASES[text] || fallback;
}

export function normalizeSex(value, fallback = SEX.MALE) {
  return SEX_IDS.has(value) ? value : fallback;
}

export function blankCharacterForm() {
  return {
    id: '',
    name: '',
    sex: SEX.MALE,
    group: GROUPS.CUSTOM,
    hp: 3,
    maxHp: 3,
    equipSlots: 3,
    description: '',
    skillIds: [],
    imageUrl: '',
  };
}

/** 任意来源 → 合法表单；缺字段安全回退 */
export function normalizeCharacterForm(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const hp = clampNumber(src.hp, 1, 9, 3);
  const maxHp = clampNumber(src.maxHp, hp, 9, hp);
  return {
    id: String(src.id || '').trim().slice(0, 60),
    name: String(src.name || '').trim().slice(0, 20),
    sex: normalizeSex(src.sex),
    group: normalizeGroup(src.group),
    hp,
    maxHp: Math.max(hp, maxHp),
    equipSlots: clampNumber(src.equipSlots ?? src.equipLimit, 1, 6, 3),
    description: String(src.description || '').slice(0, 400),
    skillIds: Array.isArray(src.skillIds)
      ? [...new Set(src.skillIds.filter(id => typeof id === 'string' && id))].slice(0, 20)
      : [],
    imageUrl: isSafeImageUrl(src.imageUrl) ? String(src.imageUrl).trim() : '',
  };
}

export function normalizeAppearance(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const frame = WORKSHOP_FRAMES.some(f => f.id === src.frame) ? src.frame : 'gold';
  const accent = WORKSHOP_ACCENTS.some(a => a.color === src.accent) ? src.accent : '#a83a32';
  return { frame, accent };
}

/** 桌面 card-editor 导出格式检测 */
export function isCardEditorPayload(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.faction !== undefined || raw.artUrl !== undefined) return true;
  return Array.isArray(raw.skills)
    && raw.skills.some(s => s && typeof s === 'object' && ('desc' in s || 'timing' in s));
}

/** 游戏 Character.toJSON 格式检测 */
export function isGameCharacterPayload(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return Array.isArray(raw.skillIds) || raw.group !== undefined || raw.sex !== undefined;
}

/** 按技能名匹配 store.skills（大小写/空白宽松） */
export function matchSkillsByName(cardSkills, storeSkills = []) {
  const pool = (storeSkills || []).filter(Boolean);
  const byName = new Map();
  pool.forEach(skill => {
    const key = String(skill.name || '').trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, skill);
  });
  const skillIds = [];
  const unmatched = [];
  const matched = [];
  (Array.isArray(cardSkills) ? cardSkills : []).forEach(item => {
    const name = typeof item === 'string' ? item : String(item?.name || '').trim();
    if (!name) return;
    const hit = byName.get(name.toLowerCase());
    if (hit) {
      if (!skillIds.includes(hit.id)) skillIds.push(hit.id);
      matched.push({ name, id: hit.id });
    } else {
      unmatched.push(name);
    }
  });
  return { skillIds, unmatched, matched };
}

/** 桌面卡牌 JSON → 游戏武将表单 */
export function mapCardEditorJson(raw, storeSkills = []) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'JSON 根节点必须是对象' };
  const name = String(raw.name || '').trim().slice(0, 20);
  if (!name) return { ok: false, error: '桌面卡牌 JSON 缺少 name' };
  const hp = clampNumber(raw.hp, 1, 9, 3);
  const { skillIds, unmatched } = matchSkillsByName(raw.skills, storeSkills);
  const form = normalizeCharacterForm({
    id: '',
    name,
    sex: raw.sex || SEX.MALE,
    group: normalizeGroup(raw.faction, GROUPS.CUSTOM),
    hp,
    maxHp: hp,
    equipSlots: raw.equipSlots ?? raw.equipLimit,
    description: String(raw.flavor || raw.brief || '').trim(),
    skillIds,
    imageUrl: raw.artUrl || '',
  });
  const appearance = normalizeAppearance({ frame: raw.frame, accent: raw.accent });
  const meta = {
    number: String(raw.number || '').slice(0, 20),
    artist: String(raw.artist || '').slice(0, 30),
    rarity: String(raw.rarity || ''),
    cost: clampNumber(raw.cost, 0, 15, 0),
  };
  return { ok: true, format: 'card', form, appearance, meta, unmatched };
}

/** 游戏 Character JSON → 表单 */
export function mapGameCharacterJson(raw, storeSkills = []) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'JSON 根节点必须是对象' };
  const name = String(raw.name || '').trim();
  if (!name) return { ok: false, error: '武将 JSON 缺少 name' };
  const form = normalizeCharacterForm(raw);
  const known = new Set((storeSkills || []).map(s => s.id));
  const unmatched = form.skillIds.filter(id => !known.has(id));
  return { ok: true, format: 'game', form, appearance: normalizeAppearance({}), meta: {}, unmatched };
}

/** 统一导入入口：自动识别两种格式 */
export function extractCharacterImport(raw, storeSkills = []) {
  if (isCardEditorPayload(raw)) return mapCardEditorJson(raw, storeSkills);
  if (isGameCharacterPayload(raw)) return mapGameCharacterJson(raw, storeSkills);
  return { ok: false, error: '无法识别 JSON 格式：需要游戏武将 JSON 或桌面卡牌 JSON' };
}

/** 导出游戏 Character 配置（不含外观等预览字段） */
export function buildCharacterExport(form) {
  const normalized = normalizeCharacterForm(form);
  return {
    id: normalized.id,
    name: normalized.name,
    sex: normalized.sex,
    group: normalized.group,
    hp: normalized.hp,
    maxHp: normalized.maxHp,
    equipSlots: normalized.equipSlots,
    skillIds: normalized.skillIds,
    description: normalized.description,
    imageUrl: normalized.imageUrl,
  };
}

function makeAutoId(name = 'character') {
  const safe = name.replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5-]/g, '') || 'character';
  return `custom_${safe}_${Date.now().toString(36)}`;
}

/**
 * 保存前校验/生成 id：
 * - 名称必填
 * - 新增且 id 与已有冲突时自动生成新 id，并返回 idCollision
 * - 编辑态沿用 editingId
 */
export function buildCharacterSavePayload(form, { editingId = null, existingIds = [] } = {}) {
  const normalized = normalizeCharacterForm(form);
  if (!normalized.name) return { ok: false, error: '请先填写武将名称' };
  let id = normalized.id;
  let idCollision = false;
  if (editingId) {
    id = editingId;
  } else if (!id) {
    id = makeAutoId(normalized.name);
  } else if (existingIds.includes(id)) {
    idCollision = true;
    id = `${id}_${Date.now().toString(36)}`;
  }
  return {
    ok: true,
    id,
    idCollision,
    config: {
      ...normalized,
      id,
      maxHp: Math.max(normalized.hp, normalized.maxHp),
    },
  };
}

/* ---------------- 草稿（只保存在本地，不写入 Character） ---------------- */

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // SSR / 隐私模式
  }
  return null;
}

export function loadCharacterDraft(storage) {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(CHARACTER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      form: normalizeCharacterForm(parsed?.form),
      appearance: normalizeAppearance(parsed?.appearance),
      meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
      editingId: typeof parsed?.editingId === 'string' ? parsed.editingId : null,
    };
  } catch {
    return null;
  }
}

export function saveCharacterDraft({ form, appearance, meta, editingId }, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(CHARACTER_DRAFT_KEY, JSON.stringify({
      form: normalizeCharacterForm(form),
      appearance: normalizeAppearance(appearance),
      meta: meta && typeof meta === 'object' ? meta : {},
      editingId: editingId || null,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

/** 首次进入工坊：优先外部 initialForm（测试/深链），否则草稿，否则空白 */
export function buildWorkshopInitialState(initialForm = null, storage) {
  const draft = loadCharacterDraft(storage);
  const source = initialForm ? normalizeCharacterForm(initialForm) : (draft?.form || blankCharacterForm());
  return {
    form: source,
    appearance: draft?.appearance || normalizeAppearance({}),
    meta: initialForm ? {} : (draft?.meta || {}),
    editingId: initialForm ? null : (draft?.editingId || null),
  };
}
