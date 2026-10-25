/**
 * AIPlayer - AI出牌决策系统
 * 更智能的AI逻辑，包含态度判断、手牌评估、策略选择
 */

/**
 * AI态度值: 正值=友好, 负值=敌对
 * @param {Player} from - AI玩家
 * @param {Player} to - 目标玩家
 * @returns {number} 态度值 [-100, 100]
 */
export function getAttitude(from, to) {
  if (from === to) return 100; // 对自己最友好

  // 基础: 所有非自己都是敌人
  let attitude = -50;

  // 同势力+20
  if (from.character && to.character && from.character.group === to.character.group) {
    attitude += 20;
  }

  // 存储中的态度修正(技能可能修改)
  const customAtt = from.getStorage(`attitude_${to.id}`);
  if (customAtt !== undefined) attitude += customAtt;

  return attitude;
}

/**
 * 评估手牌价值
 * @param {Card} card
 * @param {Player} player
 * @param {Game} game
 * @returns {number} 价值[0, 10]
 */
export function evaluateCard(card, player, game) {
  switch (card.name) {
    case '桃':
      return player.hp <= 1 ? 10 : (player.hp < player.maxHp ? 7 : 3);
    case '杀':
      return player.canSha ? 6 : 2;
    case '闪':
      return 4; // 防御牌
    case '酒':
      return player.canSha ? 5 : 3;
    case '无中生有':
      return 9; // 极高价值
    case '决斗':
      return 6;
    case '南蛮入侵':
    case '万箭齐发':
      return 7;
    case '桃园结义':
      return player.hp < player.maxHp ? 6 : 2;
    case '无懈可击':
      return 5;
    case '顺手牵羊':
      return 5;
    case '过河拆桥':
      return 5;
    case '乐不思蜀':
      return 7;
    case '兵粮寸断':
      return 6;
    case '闪电':
      return 3; // 闪电风险大
    default:
      if (card.type === 'equip') return 7;
      return 4;
  }
}

/**
 * AI决策: 出牌阶段选择最优动作
 * @param {Player} player
 * @param {Game} game
 * @returns {object|null} 动作 {card, targets} 或 null
 */
export function decidePlay(player, game) {
  const handCards = [...player.handCards];

  // 按价值排序
  const evaluated = handCards.map(card => ({
    card,
    value: evaluateCard(card, player, game),
  })).sort((a, b) => b.value - a.value);

  for (const { card, value } of evaluated) {
    const action = tryPlayCard(card, player, game);
    if (action) return action;
  }

  return null; // 结束出牌
}

/**
 * 尝试出某张牌
 */
function tryPlayCard(card, player, game) {
  switch (card.name) {
    case '桃': {
      if (player.hp < player.maxHp) return { card, targets: [player] };
      return null;
    }
    case '杀': {
      if (!player.canSha) return null;
      const targets = game.distance.getShaTargets(player);
      if (targets.length === 0) return null;
      // 优先选态度最负(敌意最高)的目标
      targets.sort((a, b) => getAttitude(player, a) - getAttitude(player, b));
      return { card, targets: [targets[0]] };
    }
    case '酒': {
      if (!player.canSha) return null;
      const sha = player.handCards.find(c => c.name === '杀');
      if (!sha) return null;
      return { card, targets: [] };
    }
    case '无中生有':
      return { card, targets: [] };
    case '决斗': {
      const targets = game.distance.getOtherAlivePlayers(player);
      if (targets.length === 0) return null;
      targets.sort((a, b) => getAttitude(player, a) - getAttitude(player, b));
      return { card, targets: [targets[0]] };
    }
    case '南蛮入侵':
    case '万箭齐发':
      return { card, targets: [] };
    case '桃园结义': {
      const injured = game.getAlivePlayers().filter(p => p.hp < p.maxHp);
      if (injured.length > 0) return { card, targets: [] };
      return null;
    }
    case '顺手牵羊':
    case '过河拆桥': {
      const targets = game.distance.getOtherAlivePlayers(player)
        .filter(t => t.handCardCount > 0 && game.distance.getSeatDistance(player, t) <= 1);
      if (targets.length === 0) return null;
      targets.sort((a, b) => getAttitude(player, a) - getAttitude(player, b));
      return { card, targets: [targets[0]] };
    }
    case '乐不思蜀':
    case '兵粮寸断': {
      const targets = game.distance.getOtherAlivePlayers(player);
      if (targets.length === 0) return null;
      targets.sort((a, b) => getAttitude(player, a) - getAttitude(player, b));
      return { card, targets: [targets[0]] };
    }
    case '闪电':
      return null; // AI不主动放闪电
    default:
      if (card.type === 'equip') return { card, targets: [] };
      return null;
  }
}

/**
 * AI决策: 弃牌阶段选择弃哪些牌
 * @param {Player} player
 * @param {number} count
 * @param {Game} game
 * @returns {Card[]} 要弃的牌
 */
export function decideDiscard(player, count, game) {
  const handCards = [...player.handCards];
  // 按价值升序排列(弃价值最低的)
  const evaluated = handCards.map(card => ({
    card,
    value: evaluateCard(card, player, game),
  })).sort((a, b) => a.value - b.value);

  return evaluated.slice(0, count).map(e => e.card);
}

/**
 * AI决策: 是否使用某张牌响应
 * @param {Player} player
 * @param {string} responseType - 'shan'(闪) / 'sha'(杀) / 'tao'(桃)
 * @param {Game} game
 * @returns {Card|null}
 */
export function decideRespond(player, responseType, game) {
  switch (responseType) {
    case 'shan': {
      const shan = player.handCards.find(c => c.name === '闪');
      return shan || null;
    }
    case 'sha': {
      const sha = player.handCards.find(c => c.name === '杀');
      return sha || null;
    }
    case 'tao': {
      const tao = player.handCards.find(c => c.name === '桃');
      return tao || null;
    }
    default:
      return null;
  }
}

/**
 * AI决策: 技能是否发动
 * @param {Skill} skill
 * @param {object} event
 * @param {Player} player
 * @param {Game} game
 * @returns {boolean}
 */
export function decideSkill(skill, event, player, game) {
  // 锁定技总是发动
  if (skill.forced) return true;
  // 使用次数检查
  if (skill.usable > 0 && skill.usedCount >= skill.usable) return false;
  // 使用自定义check
  try {
    return skill.ai.check(event, player);
  } catch {
    return false;
  }
}
