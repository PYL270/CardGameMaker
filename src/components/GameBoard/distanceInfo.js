/**
 * distanceInfo - 距离可视化纯函数（仅用 gameState 公开数据，联机客户端同样适用）
 *
 * 与 src/core/Distance.js / Player.js 规则保持一致：
 * - 存活玩家按 seatNum 组成环形，座次距离 = min(|i-j|, n-|i-j|)
 * - 攻击距离 = max(1, 座次距离 + 目标防御马(+1) + 自己进攻马(-1) + 自己 distanceFix)
 * - 攻击范围 = 自己武器 range（无武器 = 1）
 *
 * 联机客户端的 equips 来自公开序列化，可能缺少 range 字段 → 按标准武器名兜底。
 */

/** 标准武器攻击范围（Card.toJSON 带 range 时优先使用） */
export const WEAPON_RANGE_BY_NAME = {
  诸葛连弩: 1,
  青釭剑: 2,
  雌雄双股剑: 2,
  寒冰剑: 2,
  青龙偃月刀: 3,
  丈八蛇矛: 3,
  贯石斧: 3,
  方天画戟: 4,
  麒麟弓: 5,
};

const isAlivePlayer = (p) => !!p && (p.status ? p.status === 'alive' : true);

function equipOf(player, slot) {
  const eq = player && player.equips && player.equips[slot];
  return eq || null;
}

/** 存活玩家按 seatNum 升序（座次环）；缺失 seatNum 时按数组顺序兜底 */
export function aliveSeatOrder(players) {
  if (!Array.isArray(players)) return [];
  const entries = [];
  players.forEach((player, idx) => {
    if (!isAlivePlayer(player)) return;
    const seat = Number(player.seatNum);
    entries.push({
      player,
      seat: Number.isFinite(seat) ? seat : idx,
      idx,
    });
  });
  entries.sort((a, b) => (a.seat - b.seat) || (a.idx - b.idx));
  return entries.map(e => e.player);
}

function orderIndexOf(order, player) {
  if (!player) return -1;
  const direct = order.indexOf(player);
  if (direct >= 0) return direct;
  if (player.id !== undefined && player.id !== null) {
    const byId = order.findIndex(p => p && p.id === player.id);
    if (byId >= 0) return byId;
  }
  if (player.seatNum !== undefined && player.seatNum !== null) {
    const seat = Number(player.seatNum);
    const bySeat = order.findIndex(p => Number(p?.seatNum) === seat);
    if (bySeat >= 0) return bySeat;
  }
  return -1;
}

/** 环形座次距离；目标自己=0；无法定位/不足 2 人时安全返回 null/0 */
export function seatDistance(me, target, players) {
  if (!me || !target) return null;
  const order = aliveSeatOrder(players);
  if (order.length < 2) return 0;
  const i = orderIndexOf(order, me);
  const j = orderIndexOf(order, target);
  if (i < 0 || j < 0) return null;
  if (i === j) return 0;
  const n = order.length;
  const diff = Math.abs(i - j);
  return Math.min(diff, n - diff);
}

/** 攻击范围：武器 range 优先；联机序列化缺 range 时按武器名兜底；无武器=1 */
export function attackRange(player) {
  // 本地 Player 实例：直接复用引擎方法（含羁绊/技能等动态加成）
  if (player && typeof player.getAttackRange === 'function') {
    try {
      const engineRange = Number(player.getAttackRange());
      if (Number.isFinite(engineRange) && engineRange > 0) return engineRange;
    } catch { /* 公开快照回退 */ }
  }
  const bondRange = Math.max(0, Number(player?.bondAttackRange) || 0);
  const weapon = equipOf(player, 'weapon');
  if (!weapon) return 1 + bondRange;
  const explicit = Number(weapon.range);
  if (Number.isFinite(explicit) && explicit > 0) return explicit + bondRange;
  return (WEAPON_RANGE_BY_NAME[weapon.name] || 1) + bondRange;
}

/** 自己武器名（用于攻击范围 title） */
export function weaponName(player) {
  const weapon = equipOf(player, 'weapon');
  return weapon?.name || null;
}

/** 攻击距离 = max(1, 座次距离 + 目标防御马 - 自己进攻马 + 自己 distanceFix) */
export function attackDistance(me, target, players) {
  const base = seatDistance(me, target, players);
  if (base === null) return null;
  if (base === 0) return 0;
  const defFix = equipOf(target, 'horse_def') ? 1 : 0;
  const atkFix = (equipOf(me, 'horse_atk') ? -1 : 0) + (Number(me?.distanceFix) || 0);
  return Math.max(1, base + defFix + atkFix);
}

/** 是否在攻击范围内；目标为自己/数据异常时安全返回 false/null */
export function isInAttackRange(me, target, players) {
  if (!me || !target) return null;
  if (me === target) return false;
  const dist = attackDistance(me, target, players);
  if (dist === null) return null;
  return dist <= attackRange(me);
}

/**
 * 组合提示：供 PlayerArea / ActionPanel 统一使用
 * @returns {{distance:number, range:number, inRange:boolean, label:string, title:string}|null}
 */
export function distanceHint(me, target, players) {
  if (!me || !target) return null;
  const distance = attackDistance(me, target, players);
  if (distance === null) return null;
  const range = attackRange(me);
  const inRange = me === target ? false : distance <= range;
  return {
    distance,
    range,
    inRange,
    label: `距离 ${distance}`,
    title: `${inRange ? '攻击范围内' : '攻击范围外'}（你的攻击范围 ${range}）`,
  };
}

/** 自己卡片的攻击范围说明（无武器时明确默认 1） */
export function attackRangeHint(player) {
  const range = attackRange(player);
  const name = weaponName(player);
  return {
    range,
    label: `攻击范围 ${range}`,
    title: name ? `武器【${name}】攻击范围 ${range}` : `未装备武器，攻击范围 ${range}`,
  };
}

/** 目标按钮文案：`敌人1` → `敌人1 · 距离2`（无法计算时原样返回） */
export function targetLabelWithDistance(me, target, players) {
  const name = target?.name || '';
  const hint = distanceHint(me, target, players);
  return hint ? `${name} · 距离${hint.distance}` : name;
}
