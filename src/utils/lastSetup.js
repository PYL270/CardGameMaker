/**
 * 上次阵容：把「开始对局」用过的配置存进 localStorage。
 * 主菜单靠它做「一键开局」，选将页靠它回填上次的玩家数 / 模式 / 武将。
 *
 * 只存最小信息（座位、组队模式、误伤、自动触发），不存牌局状态。
 */
export const LAST_SETUP_KEY = 'cgm_last_setup';

const TEAM_MODES = ['ffa', '2v2', '3v3'];
const MIN_SEATS = 2;
const MAX_SEATS = 6;

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* SSR 或隐私模式 */
  }
  return null;
}

function normalizeSeat(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name.trim()
    : `座位${index + 1}`;
  return {
    name,
    isAI: index > 0 ? raw.isAI !== false : false,
    team: typeof raw.team === 'string' && raw.team ? raw.team : null,
    characterId: typeof raw.characterId === 'string' && raw.characterId ? raw.characterId : null,
  };
}

/** 把任意来源的数据规范成可用配置；不合格返回 null */
export function normalizeSetup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const configs = Array.isArray(raw.configs)
    ? raw.configs.map(normalizeSeat).filter(Boolean)
    : [];
  if (configs.length < MIN_SEATS) return null;
  if (configs.length > MAX_SEATS) configs.length = MAX_SEATS;

  const teamMode = TEAM_MODES.includes(raw.teamMode) ? raw.teamMode : 'ffa';
  return {
    configs,
    teamMode,
    friendlyFire: raw.friendlyFire === true,
    autoTrigger: raw.autoTrigger === true,
    savedAt: Number(raw.savedAt) || 0,
  };
}

export function readLastSetup(storage) {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_SETUP_KEY);
    if (!raw) return null;
    return normalizeSetup(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLastSetup(setup, storage) {
  const store = resolveStorage(storage);
  const next = normalizeSetup(setup);
  if (!store || !next) return null;
  try {
    store.setItem(LAST_SETUP_KEY, JSON.stringify({ ...next, savedAt: Date.now() }));
  } catch {
    /* 配额满 / 隐私模式：忽略即可，不影响开局 */
  }
  return next;
}

/** 从上次阵容提取 { seatIndex: characterId }，给选将页回填 */
export function setupSelectedChars(setup) {
  const map = {};
  (setup?.configs || []).forEach((seat, i) => {
    if (seat?.characterId) map[i] = seat.characterId;
  });
  return map;
}
