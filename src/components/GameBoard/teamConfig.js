/**
 * teamConfig - 组队/阵营纯函数（2v2 / 3v3）与默认配置持久化
 *
 * 引擎契约（防御性读取，引擎尚未合入时也能工作）：
 * - teamMode ∈ {'ffa','2v2','3v3'}，默认 ffa
 * - player.team ∈ {0,1} 或 null；组队模式按座位奇偶：0,2,4 → 队伍0，1,3,5 → 队伍1
 * - player.seatNum 用于兜底推断队伍
 */

export const TEAM_MODES = ['ffa', '2v2', '3v3'];

export const TEAM_MODE_OPTIONS = [
  { id: 'ffa', label: '自由混战', playerCount: null, desc: '各自为战，可自由选择 2~6 人' },
  { id: '2v2', label: '2v2 组队', playerCount: 4, desc: '4 人两队：你与队友1 vs 敌人1、敌人2' },
  { id: '3v3', label: '3v3 组队', playerCount: 6, desc: '6 人两队：你、队友1、队友2 vs 敌人1~3' },
];

export const GAME_CONFIG_STORAGE_KEY = 'cgm_game_config';

export function normalizeTeamMode(mode) {
  return TEAM_MODES.includes(mode) ? mode : 'ffa';
}

export function isTeamMode(mode) {
  return normalizeTeamMode(mode) !== 'ffa';
}

export function teamModeLabel(mode) {
  const m = normalizeTeamMode(mode);
  const opt = TEAM_MODE_OPTIONS.find(o => o.id === m);
  return opt ? opt.label : '自由混战';
}

/** 组队模式固定人数；自由混战返回 null（可选 2~6） */
export function teamPlayerCount(mode) {
  const m = normalizeTeamMode(mode);
  const opt = TEAM_MODE_OPTIONS.find(o => o.id === m);
  return opt && opt.playerCount ? opt.playerCount : null;
}

/** 座位所属队伍：组队模式按奇偶交替（0,2,4=队伍0；1,3,5=队伍1）；自由混战 null */
export function seatTeam(seat, mode) {
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') return null;
  const n = Number(seat);
  if (!Number.isFinite(n) || n < 0) return null;
  return n % 2; // 偶数座位 → 0；奇数座位 → 1
}

/** 防御性读取玩家队伍：优先 player.team，其次按 seatNum 推断 */
export function playerTeamOf(player, mode) {
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') return null;
  if (player && (player.team === 0 || player.team === 1)) return player.team;
  return seatTeam(player?.seatNum, m);
}

/** 座位显示名：自由混战沿用原命名；组队模式为 你 / 队友N / 敌人N */
export function seatLabel(seat, mode) {
  const n = Number(seat) || 0;
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') return n === 0 ? '你' : `AI${n}`;
  if (n === 0) return '你';
  const team = seatTeam(n, m);
  if (team === 0) return `队友${Math.floor(n / 2)}`;
  return `敌人${Math.floor((n + 1) / 2)}`;
}

/** 组队分组预览：{ ally: [...], enemy: [...] }；自由混战 null */
export function teamPreview(mode) {
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') return null;
  const count = teamPlayerCount(m);
  const ally = [];
  const enemy = [];
  for (let seat = 0; seat < count; seat++) {
    (seatTeam(seat, m) === 0 ? ally : enemy).push(seatLabel(seat, m));
  }
  return { ally, enemy };
}

/** 生成带队伍字段的玩家配置（ffa 时 team=null） */
export function buildTeamConfigs(count, mode, selectedChars = {}) {
  const m = normalizeTeamMode(mode);
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      name: seatLabel(i, m),
      isAI: i > 0,
      team: m === 'ffa' ? null : seatTeam(i, m),
      characterId: selectedChars[i] || null,
    });
  }
  return list;
}

/** 牌桌队伍标签：ffa 返回 null；同队返回“我方”，异队返回“敌方” */
export function teamChipFor(player, selfSeat, mode) {
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') return null;
  const playerTeam = playerTeamOf(player, m);
  const selfTeam = playerTeamOf({ seatNum: selfSeat }, m);
  if (playerTeam === null || selfTeam === null) return null;
  return playerTeam === selfTeam ? '我方' : '敌方';
}

export function teamClassFor(chip) {
  if (chip === '我方') return 'team-ally';
  if (chip === '敌方') return 'team-enemy';
  return '';
}

/**
 * 组队胜负与结果文案（防御性：按存活队伍判断，不依赖引擎只检查 players[0]）
 * @returns {{won:boolean, subtitle:string|null}}
 */
export function computeTeamOutcome(players, selfSeat, mode, selfPlayer = null) {
  const m = normalizeTeamMode(mode);
  if (m === 'ffa') {
    return { won: selfPlayer?.status === 'alive', subtitle: null };
  }
  const selfTeam = playerTeamOf({ seatNum: selfSeat }, m);
  const enemyTeam = selfTeam === 0 ? 1 : 0;
  const aliveTeams = new Set();
  (players || []).forEach(p => {
    if (p?.status !== 'alive') return;
    const t = playerTeamOf(p, m);
    if (t !== null) aliveTeams.add(t);
  });
  const selfAlive = aliveTeams.has(selfTeam);
  const enemyAlive = aliveTeams.has(enemyTeam);
  const won = selfAlive && !enemyAlive
    ? true
    : (enemyAlive ? false : selfAlive || selfPlayer?.status === 'alive');
  return { won, subtitle: won ? '你与队友获胜' : '你的队伍失败' };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 隐私模式 / SSR
  }
  return null;
}

/** 读取设置页保存的默认组队模式；损坏/非法回退 ffa */
export function readDefaultTeamMode(storage) {
  const store = resolveStorage(storage);
  if (!store) return 'ffa';
  try {
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (!raw) return 'ffa';
    const cfg = JSON.parse(raw);
    return normalizeTeamMode(cfg?.teamMode);
  } catch {
    return 'ffa';
  }
}

/** 保存默认组队模式（合并进 cgm_game_config，不覆盖其它游戏设置） */
export function saveDefaultTeamMode(mode, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    let cfg = {};
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (raw) {
      try { cfg = JSON.parse(raw) || {}; } catch { cfg = {}; }
    }
    cfg.teamMode = normalizeTeamMode(mode);
    store.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- 允许攻击队友（误伤） ---------------- */

/** 自由混战时误伤开关不可用；仅组队模式 true */
export function friendlyFireDisabled(teamMode) {
  return !isTeamMode(teamMode);
}

/** 误伤值归一化：仅组队模式且显式为 true 才生效 */
export function normalizeFriendlyFire(teamMode, value) {
  if (!isTeamMode(teamMode)) return false;
  return value === true;
}

/** 开局 options：configs[].team 不变，teamMode + friendlyFire 一起传给 store */
export function buildStartOptions(teamMode, friendlyFire) {
  const mode = normalizeTeamMode(teamMode);
  return {
    teamMode: mode,
    friendlyFire: normalizeFriendlyFire(mode, friendlyFire),
  };
}

/** 目标是否为己方队友（用公开的 player.team/seatNum，联机客户端同样适用） */
export function isTeammateTarget(me, target, teamMode) {
  const mode = normalizeTeamMode(teamMode);
  if (mode === 'ffa' || !me || !target) return false;
  if (me === target) return false;
  if (me.id !== undefined && me.id !== null && target.id !== undefined && target.id !== null
    && me.id === target.id) return false;
  const myTeam = playerTeamOf(me, mode);
  const targetTeam = playerTeamOf(target, mode);
  return myTeam !== null && targetTeam !== null && myTeam === targetTeam;
}

/** 读取设置页保存的默认误伤开关；损坏/非法回退 false */
export function readDefaultFriendlyFire(storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return cfg?.friendlyFire === true;
  } catch {
    return false;
  }
}

/** 保存默认误伤开关（合并进 cgm_game_config） */
export function saveDefaultFriendlyFire(value, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    let cfg = {};
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (raw) {
      try { cfg = JSON.parse(raw) || {}; } catch { cfg = {}; }
    }
    cfg.friendlyFire = value === true;
    store.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- 可选触发技自动发动 ---------------- */

/** 自动发动仅接受严格布尔 true */
export function normalizeAutoTrigger(value) {
  return value === true;
}

/** 读取设置页保存的「可选触发技自动发动」；损坏/非法回退 false */
export function readDefaultAutoTrigger(storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return cfg?.autoTrigger === true;
  } catch {
    return false;
  }
}

/** 保存「可选触发技自动发动」（合并进 cgm_game_config） */
export function saveDefaultAutoTrigger(value, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    let cfg = {};
    const raw = store.getItem(GAME_CONFIG_STORAGE_KEY);
    if (raw) {
      try { cfg = JSON.parse(raw) || {}; } catch { cfg = {}; }
    }
    cfg.autoTrigger = value === true;
    store.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}
