/**
 * 武将羁绊：经典武将同场时激活的被动加成 + 每局一次的合击。
 *
 * 只依赖角色 ID，可同时用于引擎 Player、联机公开快照和选将面板。
 * 数值克制：被动最多 +1，合击每局仅一次，不改变原有基础牌规则。
 */

export const BONDS = Object.freeze([
  {
    id: 'taoyuan',
    name: '桃园结义',
    members: ['cls_liubei', 'cls_guanyu', 'cls_zhangfei'],
    desc: '刘备、关羽、张飞同场：全体成员体力上限 +1，并回复 1 点体力。',
    passive: 'maxHp+1，回复1',
    comboName: '桃园合击',
    comboDesc: '成员使用【杀】命中敌人时，消耗本局合击，额外造成 1 点伤害。',
  },
  {
    id: 'weimou',
    name: '魏之谋主',
    members: ['cls_caocao', 'cls_simayi'],
    desc: '曹操、司马懿同场：双方手牌上限 +1。',
    passive: '手牌上限+1',
    comboName: '魏武合谋',
    comboDesc: '成员使用【杀】命中敌人时，消耗本局合击，额外造成 1 点伤害。',
  },
  {
    id: 'jiangdong',
    name: '江东双璧',
    members: ['cls_sunquan', 'cls_zhouyu'],
    desc: '孙权、周瑜同场：双方攻击范围 +1。',
    passive: '攻击范围+1',
    comboName: '江东纵火',
    comboDesc: '成员使用【杀】命中敌人时，消耗本局合击，额外造成 1 点伤害。',
  },
  {
    id: 'wolong',
    name: '卧龙凤雏',
    members: ['cls_zhugeliang', 'cls_huangyueying'],
    desc: '诸葛亮、黄月英同场：双方每回合首次使用锦囊牌时摸 1 张牌。',
    passive: '每回合首次锦囊摸1',
    comboName: '卧龙合击',
    comboDesc: '成员使用【杀】命中敌人时，消耗本局合击，额外造成 1 点伤害。',
  },
]);

const BOND_BY_ID = new Map(BONDS.map(bond => [bond.id, bond]));

export function bondById(id) {
  return BOND_BY_ID.get(id) || null;
}

/** 从角色 ID 列表取定义，供 UI 用玩家身上的 bondIds 渲染 chip */
export function bondsByIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map(id => BOND_BY_ID.get(id)).filter(Boolean);
}

function characterIdOf(player) {
  if (!player) return '';
  if (typeof player === 'string') return player;
  return player.character?.id || player.characterId || player.character || '';
}

/**
 * 检测当前玩家集合激活的羁绊。
 * @param {Array} players - Player 实例或公开快照（character.id / characterId）
 * @returns {Array<{id,name,desc,passive,comboName,comboDesc,memberIds,members}>}
 */
export function detectBonds(players = []) {
  const list = (Array.isArray(players) ? players : []).filter(Boolean);
  const charIds = new Set(list.map(characterIdOf).filter(Boolean));
  const result = [];
  for (const bond of BONDS) {
    if (!bond.members.every(id => charIds.has(id))) continue;
    const members = list
      .filter(player => bond.members.includes(characterIdOf(player)))
      .map(player => ({
        id: player.id || null,
        name: player.name || player.character?.name || characterIdOf(player),
        seatNum: Number.isFinite(Number(player.seatNum)) ? Number(player.seatNum) : null,
        characterId: characterIdOf(player),
      }));
    result.push({ ...bond, memberIds: [...bond.members], members });
  }
  return result;
}

/** 某个玩家参与的激活羁绊（可传 players；不传时读取 player.storage bondIds） */
export function bondForPlayer(player, players = null) {
  if (!player) return [];
  if (Array.isArray(players)) {
    const charId = characterIdOf(player);
    return detectBonds(players).filter(bond => bond.memberIds.includes(charId));
  }
  const ids = typeof player.getStorage === 'function'
    ? player.getStorage('bondIds')
    : player.bondIds;
  return bondsByIds(ids);
}
