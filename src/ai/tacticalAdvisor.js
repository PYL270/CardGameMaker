/**
 * 战术军师 2.0：只读战局研判纯函数。
 *
 * 设计约束：
 * - 只读取公开状态（体力、手牌数、装备、座次、当前回合），不改动任何玩家/牌局；
 * - 联机客户端没有本地 Game 时也能给出稳定建议；
 * - 输出的中文 label 直接供军师面板渲染，不依赖组件层拼字符串。
 */

import { attackDistance, attackRange } from '../components/GameBoard/distanceInfo.js';

const CARD_TARGET_NAMES = ['杀', '决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'];
const AOE_NAMES = ['南蛮入侵', '万箭齐发', '桃园结义'];
const EQUIP_LABEL = {
  weapon: '武器',
  armor: '防具',
  horse_def: '防御坐骑',
  horse_atk: '进攻坐骑',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;
const isAlive = (player) => !!player && (!player.status || player.status === 'alive');
const handOf = (player) => (Array.isArray(player?.handCards) ? player.handCards : []);
const handCountOf = (player) => {
  const explicit = Number(player?.handCardCount);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return handOf(player).length;
};
const hpOf = (player) => Math.max(0, Number(player?.hp) || 0);
const maxHpOf = (player, fallback = 4) => Math.max(1, Number(player?.maxHp) || Number(player?.hp) || fallback);
const equipList = (player) => {
  if (Array.isArray(player?.equipCards)) return player.equipCards;
  if (player?.equips && typeof player.equips === 'object') {
    return Object.values(player.equips).filter(Boolean);
  }
  return [];
};
const equipCountOf = (player) => equipList(player).length;
const seatOf = (player) => {
  const seat = Number(player?.seatNum);
  return Number.isFinite(seat) ? seat : 0;
};
const nameOf = (player, fallback = '对手') => player?.name || player?.character?.name || fallback;
const sameTeam = (a, b, teamMode) => (
  teamMode && teamMode !== 'ffa'
  && a?.team !== null && a?.team !== undefined
  && b?.team !== null && b?.team !== undefined
  && a.team === b.team
);

/** 公开装备是否包含某个牌名（联机快照可能没有 equipCards） */
function hasEquipName(player, name) {
  return equipList(player).some((entry) => {
    const card = entry?.card || entry;
    return card?.name === name;
  });
}

/** 单名对手的威胁分：0-100，越高越需要优先处理 */
function threatScore(player, self, { currentPlayer, teamMode } = {}) {
  if (!isAlive(player)) return 0;
  const hp = hpOf(player);
  const maxHp = maxHpOf(player);
  const ratio = hp / maxHp;
  let score = 18;
  score += ratio * 30;
  score += Math.min(6, handCountOf(player)) * 5;
  score += Math.min(3, equipCountOf(player)) * 5;
  if (currentPlayer?.id && player.id === currentPlayer.id) score += 11;
  if (hp <= 1) score += 9; // 残血反扑/求桃同样可能改变局势
  const range = (() => {
    try { return attackRange(player); } catch { return 1; }
  })();
  if (self) {
    try {
      const dist = attackDistance(player, self, [self, player]);
      if (dist !== null && dist <= range) score += 4;
    } catch { /* 公开数据不足时忽略距离 */ }
  }
  if (sameTeam(player, self, teamMode)) score -= 32;
  return clamp(Math.round(score), 0, 100);
}

/** 威胁标签：只描述可观察到的公开信息 */
function threatLabel(player, { currentPlayer } = {}) {
  if (!isAlive(player)) return '已退场';
  if (currentPlayer?.id && player.id === currentPlayer.id) return '正在行动';
  if (hpOf(player) <= 1) return '残血反扑';
  if (hpOf(player) >= maxHpOf(player) && handCountOf(player) >= 4) return '满状态蓄势';
  if (handCountOf(player) >= 4) return '蓄牌待发';
  if (equipCountOf(player) >= 2) return '装备压制';
  if (hpOf(player) < maxHpOf(player)) return '受损待机';
  return '伺机而动';
}

/**
 * 战局研判：胜率、威胁榜、自身评分。
 * @returns {{winRate:number, threats:Array, selfScore:number}}
 */
export function evaluatePosition({ self = null, players = [], teamMode = 'ffa', currentPhase = '', currentPlayer = null } = {}) {
  const list = (Array.isArray(players) ? players : []).filter(Boolean);
  const selfPlayer = self || list[0] || null;
  if (!selfPlayer) {
    return { winRate: 50, threats: [], selfScore: 0, phase: currentPhase || '' };
  }

  const alive = list.filter(isAlive);
  const selfHp = hpOf(selfPlayer);
  const selfMaxHp = maxHpOf(selfPlayer);
  const hpRatio = selfMaxHp > 0 ? selfHp / selfMaxHp : 0;
  const selfScore = clamp(Math.round(
    hpRatio * 52
    + Math.min(6, handCountOf(selfPlayer)) * 4
    + Math.min(3, equipCountOf(selfPlayer)) * 4
    + (isAlive(selfPlayer) ? 8 : 0)
  ), 0, 100);

  const enemies = alive.filter(p => p.id !== selfPlayer.id && !sameTeam(p, selfPlayer, teamMode));
  const allies = alive.filter(p => p.id !== selfPlayer.id && sameTeam(p, selfPlayer, teamMode));
  const threats = enemies
    .map(player => ({
      id: player.id,
      name: nameOf(player),
      seat: seatOf(player),
      score: threatScore(player, selfPlayer, { currentPlayer, teamMode }),
      label: threatLabel(player, { currentPlayer }),
      hp: hpOf(player),
      maxHp: maxHpOf(player),
      handCardCount: handCountOf(player),
    }))
    .sort((a, b) => (b.score - a.score) || (a.seat - b.seat));

  const enemyPressure = threats.slice(0, 3).reduce((sum, t) => sum + t.score, 0) / Math.max(1, Math.min(3, threats.length));
  const allyBonus = allies.length * 9;
  const teamBonus = enemies.length ? 0 : 16;
  const winRate = clamp(Math.round(
    50
    + (selfScore - 50) * 0.44
    + allyBonus
    - Math.max(0, enemyPressure - 42) * 0.42
    + teamBonus
  ), 4, 96);

  return {
    winRate,
    threats,
    selfScore,
    phase: currentPhase || '',
    allyCount: allies.length,
    enemyCount: enemies.length,
  };
}

/**
 * 公开信息意图预测（不读取手牌内容/隐藏技能）。
 * @returns {{kind:string, label:string, tone:string}}
 */
export function predictIntent(player, { currentPlayer = null, phase = '' } = {}) {
  if (!player) return { kind: 'unknown', label: '情况不明', tone: 'observe' };
  if (!isAlive(player)) return { kind: 'down', label: '已阵亡', tone: 'muted' };

  const hp = hpOf(player);
  const maxHp = maxHpOf(player);
  const hand = handCountOf(player);
  const equips = equipCountOf(player);
  const isCurrent = !!(currentPlayer?.id && player.id === currentPlayer.id);

  if (hp <= 1) {
    return hand > 0
      ? { kind: 'peach', label: '可能求桃', tone: 'danger' }
      : { kind: 'rescue', label: '濒死待援', tone: 'danger' };
  }
  if (isCurrent) {
    if (phase === 'draw') return { kind: 'prepare', label: '准备行动', tone: 'alert' };
    if (phase === 'discard') return { kind: 'tidy', label: '整理手牌', tone: 'observe' };
    if (phase && phase !== 'play') return { kind: 'phase', label: '推进阶段', tone: 'observe' };
    if (hand >= 3) return { kind: 'attack', label: '可能进攻', tone: 'alert' };
    if (hand <= 1) return { kind: 'probe', label: '试探出牌', tone: 'observe' };
    return { kind: 'act', label: '寻找战机', tone: 'calm' };
  }
  if (hand >= 4) return { kind: 'gather', label: '蓄牌观望', tone: 'observe' };
  if (hand < maxHp && hp < maxHp) return { kind: 'peach', label: '可能求桃', tone: 'danger' };
  if (equips > 0 && hand >= 2) return { kind: 'equip', label: '装备蓄势', tone: 'observe' };
  if (hand === 0) return { kind: 'empty', label: '空手待援', tone: 'muted' };
  return { kind: 'wait', label: '谨慎观望', tone: 'observe' };
}

function targetNameOf(action) {
  return action?.targets?.[0]?.name || action?.target?.name || '';
}

function describeCardAction(action, { source = 'fallback' } = {}) {
  const card = action?.card;
  if (!card) return null;
  const name = card.name || '牌';
  const target = targetNameOf(action);
  const targetPart = target ? ` → ${target}` : '';
  let kind = 'card';
  let label = `使用【${name}】${targetPart}`;
  if (name === '杀') label = `使用【杀】${targetPart || '压制对手'}`;
  else if (name === '桃') label = '使用【桃】回复体力';
  else if (name === '无中生有') label = '使用【无中生有】补充手牌';
  else if (name === '决斗') label = `使用【决斗】${targetPart || '逼迫对手拼杀'}`;
  else if (name === '南蛮入侵' || name === '万箭齐发') label = `使用【${name}】压制全场`;
  else if (name === '桃园结义') label = '使用【桃园结义】全队回复';
  else if (card.type === 'equip') {
    kind = 'equip';
    label = `装备【${name}】${EQUIP_LABEL[card.subtype] ? `（${EQUIP_LABEL[card.subtype]}）` : ''}`;
  } else if (CARD_TARGET_NAMES.includes(name)) {
    kind = 'control';
    label = `对${targetPart || '目标'} 使用【${name}】`;
  } else if (card.type === 'trick' || card.type === 'delay_trick') {
    kind = 'trick';
    label = `使用【${name}】${targetPart}`;
  }
  return {
    kind,
    label,
    cardName: name,
    targetName: target,
    tone: name === '桃' ? 'recover' : (name === '杀' || name === '决斗' ? 'attack' : 'plan'),
    source,
  };
}

/**
 * 推荐动作：优先复用 game.aiAutoPlay(self)，不可用/无 Game 时走保守牌序。
 * 只读：aiAutoPlay 本身不修改状态；本函数不会执行任何出牌。
 */
export async function recommendAction({ self = null, players = [], pendingAction = null, game = null } = {}) {
  if (!self) {
    return { kind: 'wait', label: '等待战局信息', tone: 'observe', source: 'fallback' };
  }

  if (game && typeof game.aiAutoPlay === 'function') {
    try {
      const action = await game.aiAutoPlay(self);
      if (action?.type === 'useSkill') {
        return {
          kind: 'skill',
          label: `发动技能【${action.name || action.skillId || '主动技'}】`,
          skillId: action.skillId,
          tone: 'plan',
          source: 'ai',
        };
      }
      if (action?.type === 'useWeapon') {
        return {
          kind: 'weapon',
          label: `发动武器【${action.name || action.weapon || '武器技'}】`,
          weapon: action.weapon,
          tone: 'attack',
          source: 'ai',
        };
      }
      if (action?.type === 'endPlay') {
        return { kind: 'end', label: '结束出牌，保留手牌', tone: 'calm', source: 'ai' };
      }
      const described = describeCardAction(action, { source: 'ai' });
      if (described) return described;
    } catch {
      // Game 数据不足（联机客户端/测试桩）时继续走保守建议
    }
  }

  const hand = handOf(self).length ? handOf(self) : (pendingAction?.player?.handCards || []);
  const playableIds = Array.isArray(pendingAction?.playableIds) ? pendingAction.playableIds : null;
  const usable = (card) => !playableIds || playableIds.includes(card.id);
  const find = (name) => hand.find(card => card?.name === name && usable(card));

  if (hpOf(self) < maxHpOf(self)) {
    const tao = find('桃');
    if (tao) return describeCardAction({ card: tao, targets: [] }, { source: 'fallback' });
  }
  const sha = find('杀');
  if (sha) return describeCardAction({ card: sha, targets: [] }, { source: 'fallback' });
  const equip = hand.find(card => card?.type === 'equip' && usable(card));
  if (equip) return describeCardAction({ card: equip, targets: [] }, { source: 'fallback' });
  const wzsy = find('无中生有');
  if (wzsy) return describeCardAction({ card: wzsy, targets: [] }, { source: 'fallback' });
  const trick = hand.find(card => (card?.type === 'trick' || card?.type === 'delay_trick') && usable(card));
  if (trick) return describeCardAction({ card: trick, targets: [] }, { source: 'fallback' });

  if (pendingAction?.type === 'play') {
    return { kind: 'end', label: '结束出牌，保留手牌', tone: 'calm', source: 'fallback' };
  }
  if (pendingAction) {
    return { kind: 'respond', label: '按当前提示完成应对', tone: 'observe', source: 'fallback' };
  }
  return { kind: 'wait', label: '稳住阵脚，观察对手', tone: 'calm', source: 'fallback' };
}

function riskOf(chance) {
  if (chance >= 0.62) return '高';
  if (chance >= 0.3) return '中';
  return '低';
}

/**
 * 单卡轻量推演：不掷骰、不改状态，只按公开信息估算期望与风险。
 * @returns {{label:string, expected:number, risk:string, detail:string}}
 */
export function simulateCard({ card = null, self = null, target = null, players = [] } = {}) {
  if (!card) return null;
  const name = card.name || '牌';
  const selfHp = hpOf(self);
  const selfMaxHp = maxHpOf(self);
  const targetHp = hpOf(target);
  const targetHand = handCountOf(target);
  const targetHasArmor = target ? (hasEquipName(target, '八卦阵') || hasEquipName(target, '仁王盾')) : false;
  const jiuBonus = self?.usedJiu ? 1 : 0;
  const inRange = (() => {
    if (!self || !target) return true;
    try {
      const dist = attackDistance(self, target, players?.length ? players : [self, target]);
      return dist === null || dist <= attackRange(self);
    } catch { return true; }
  })();

  if (name === '杀') {
    const dodgeChance = clamp(targetHand * 0.075 + (targetHasArmor ? 0.18 : 0), 0, 0.72);
    const base = 1 + jiuBonus;
    const expected = round1(base * (1 - dodgeChance));
    const risk = !inRange ? '高' : riskOf(dodgeChance + (targetHp <= base ? 0 : 0.08));
    return {
      label: `【杀】${inRange ? '突袭' : '距离不足'}`,
      expected,
      risk,
      detail: `预计 ${expected} 点伤害；目标手牌 ${targetHand} 张${targetHasArmor ? '、疑似有防具' : ''}${inRange ? '' : '；当前距离打不到'}`,
    };
  }
  if (name === '决斗') {
    const ownSha = handOf(self).filter(c => c.name === '杀').length;
    const expected = clamp(round1(1 + ownSha * 0.25 - targetHand * 0.08), 0.2, 3);
    return {
      label: '【决斗】逼迫拼杀',
      expected,
      risk: targetHand >= 3 ? '高' : '中',
      detail: `预计 ${expected} 点伤害；目标手牌 ${targetHand} 张，手里杀越多越稳`,
    };
  }
  if (name === '桃') {
    const heal = Math.max(0, Math.min(1, selfMaxHp - selfHp));
    return {
      label: '【桃】回复',
      expected: heal,
      risk: '无',
      detail: heal > 0 ? `回复 ${heal} 点体力（${selfHp}/${selfMaxHp} → ${Math.min(selfMaxHp, selfHp + heal)}/${selfMaxHp}）` : '体力已满，暂不需要',
    };
  }
  if (name === '无中生有') {
    return { label: '【无中生有】补牌', expected: 2, risk: '低', detail: '净赚 2 张手牌，可能被无懈可击抵消' };
  }
  if (name === '南蛮入侵' || name === '万箭齐发') {
    const others = (players || []).filter(p => p && p.id !== self?.id && isAlive(p));
    const expected = round1(others.length * 0.58);
    return {
      label: `【${name}】全场压制`,
      expected,
      risk: others.length >= 3 ? '高' : '中',
      detail: `覆盖 ${others.length} 名对手，预计命中 ${expected} 次；注意队友与反噬`,
    };
  }
  if (name === '桃园结义') {
    const allies = (players || []).filter(p => p && isAlive(p) && p.id !== self?.id);
    return {
      label: '【桃园结义】全队回复',
      expected: allies.length + 1,
      risk: '低',
      detail: `预计 ${allies.length + 1} 人回复 1 点体力（满血目标无收益）`,
    };
  }
  if (name === '过河拆桥' || name === '顺手牵羊') {
    const steal = name === '顺手牵羊';
    return {
      label: `【${name}】${steal ? '夺取' : '拆解'}关键牌`,
      expected: 1,
      risk: targetHand > 0 ? '低' : '中',
      detail: steal ? '预计获得目标 1 张牌，受距离限制' : '预计拆掉目标 1 张关键牌',
    };
  }
  if (name === '乐不思蜀' || name === '兵粮寸断') {
    return {
      label: `【${name}】限制行动`,
      expected: 1,
      risk: '中',
      detail: name === '乐不思蜀' ? '判定非红桃则跳过出牌阶段' : '判定非梅花则跳过摸牌阶段',
    };
  }
  if (name === '闪电') {
    return {
      label: '【闪电】雷击判定',
      expected: 1.5,
      risk: '高',
      detail: '黑桃 2~9 触发 2 点雷电伤害；判定失败会留在判定区',
    };
  }
  if (card.type === 'equip') {
    const label = EQUIP_LABEL[card.subtype] || '装备';
    const expected = card.subtype === 'weapon' ? Math.max(1, Number(card.range) || 1) : 1;
    return {
      label: `【${name}】${label}`,
      expected,
      risk: '低',
      detail: card.subtype === 'weapon'
        ? `攻击范围提升到 ${expected}，为后续【杀】铺路`
        : `稳固${label}位，提升攻防距离/防御`,
    };
  }
  if (card.type === 'trick' || card.type === 'delay_trick') {
    return { label: `【${name}】锦囊`, expected: 1, risk: '中', detail: '按当前局势结算，注意无懈可击与目标距离' };
  }
  return { label: `【${name}】`, expected: 0.5, risk: '中', detail: '收益取决于当前场面，建议保留关键牌' };
}

/**
 * 目标锁定摘要：供军师面板一行展示。
 * 例：目标锁定：AI1 · 距离 1 · 预计 1 点伤害 · 风险 中
 */
export function describeTargetLock({ self = null, target = null, players = [], card = null } = {}) {
  if (!self || !target) return null;
  let distance = null;
  try {
    distance = attackDistance(self, target, players?.length ? players : [self, target]);
  } catch { distance = null; }
  const simulation = simulateCard({ card, self, target, players });
  const expected = simulation?.expected ?? 1;
  const risk = simulation?.risk || '中';
  return `目标锁定：${nameOf(target, '目标')}${distance !== null ? ` · 距离 ${distance}` : ''} · 预计 ${expected} 点伤害 · 风险 ${risk}`;
}
