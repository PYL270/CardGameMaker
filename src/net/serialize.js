/**
 * serialize - 联机状态序列化
 * 客户端不运行引擎，只接收房主发来的"视图状态"进行渲染与操作
 */

/** 卡牌序列化（附带 numberDisplay，便于客户端直接渲染） */
export function serializeCard(card) {
  if (!card) return null;
  return {
    id: card.id,
    name: card.name,
    suit: card.suit,
    number: card.number,
    numberDisplay: card.numberDisplay,
    type: card.type,
    subtype: card.subtype || '',
  };
}

/** 目标玩家精简信息 */
export function serializeTarget(player) {
  if (!player) return null;
  return { id: player.id, name: player.name, seatNum: player.seatNum };
}

/** 玩家公开信息（不含手牌） */
export function serializePlayerPublic(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name,
    seatNum: player.seatNum,
    isAI: player.isAI,
    character: player.character
      ? {
        id: player.character.id,
        name: player.character.name,
        group: player.character.group,
        sex: player.character.sex,
      }
      : null,
    hp: player.hp,
    maxHp: player.maxHp,
    hujia: player.hujia,
    handCardCount: player.handCards.length,
    equips: Object.fromEntries(
      Object.entries(player.equips || {}).map(([slot, card]) => [slot, serializeCard(card)])
    ),
    judgeCards: (player.judgeCards || []).map(c => ({ id: c.id, name: c.name })),
    skills: (player.skills || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      // 技能分类（客户端类型徽标）：不泄露代码/隐藏信息
      type: s.type || 'trigger',
      triggerTiming: s.triggerTiming || '',
      forced: s.forced === true,
      usable: Number.isFinite(Number(s.usable)) ? Number(s.usable) : 1,
    })),
    status: player.status,
    isTurnedOver: player.isTurnedOver,
    isLinked: player.isLinked,
    isChained: player.isChained,
    usedJiu: player.usedJiu,
    usedJiuCount: player.usedJiuCount,
    usedSha: player.usedSha,
    // 组队阵营（引擎未合入 team 时为 null，不影响自由混战）
    team: (player.team === 0 || player.team === 1) ? player.team : null,
  };
}

/** 指定座位玩家可见信息（自己能看到手牌明细） */
export function serializePlayerForSeat(player, seat) {
  const view = serializePlayerPublic(player);
  if (player.seatNum === seat) {
    view.handCards = player.handCards.map(serializeCard);
  }
  return view;
}

/** 游戏视图状态（按座位定制，含该座位玩家自己的手牌） */
export function serializeState(game, seat) {
  return {
    status: game.status,
    surrenderSeat: game.surrenderSeat ?? null,
    teamMode: game.config?.teamMode || 'ffa',
    friendlyFire: game.config?.friendlyFire === true,
    round: game.turn.roundNumber,
    currentPhase: game.turn.currentPhase,
    currentPlayerId: game.turn.currentPlayer?.id || null,
    currentPlayer: game.turn.currentPlayer
      ? { id: game.turn.currentPlayer.id, name: game.turn.currentPlayer.name }
      : null,
    players: game.players.map(p => serializePlayerForSeat(p, seat)),
    deckInfo: game.deck.getInfo(),
    logs: game.logs.slice(-40),
  };
}

/** 出牌提示 */
export function promptPlay(game, player, { includeSkills = true } = {}) {
  return {
    type: 'play',
    player: serializePlayerPublic(player),
    cards: player.handCards.map(serializeCard),
    shaTargets: game.getValidTargets(player, '杀').map(serializeTarget),
    juedouTargets: game.getValidTargets(player, '决斗').map(serializeTarget),
    otherPlayers: game.distance.getOtherAlivePlayers(player).map(serializeTarget),
    playableIds: player.handCards
      .filter(c => game.canPlayCard(player, c))
      .map(c => c.id),
    targetsByCard: Object.fromEntries(
      ['杀', '决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'].map(name => [
        name,
        game.getValidTargets(player, name).map(serializeTarget),
      ]),
    ),
    // 装备主动技（如丈八蛇矛）与方天画戟多目标能力：远端玩家与房主本人看到同样的按钮
    weaponActions: game.getWeaponActions(player).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description || '',
    })),
    fangtianReady: !!game.hasEquip(player, '方天画戟') && player.handCards.length === 1,
    activeSkills: includeSkills
      ? game.getActiveSkills(player).map(s => ({ id: s.id, name: s.name, description: s.description || '' }))
      : [],
  };
}

/** 主动技能选牌提示（cards 已按条件过滤，附带 id/名称等最小信息） */
export function promptSelectCards(player, { cards = [], min = 1, max = 1, hint = '' } = {}) {
  return {
    type: 'selectCards',
    player: serializePlayerPublic(player),
    cards: cards.map(serializeCard),
    min,
    max: Math.min(max, cards.length),
    hint,
  };
}

/** 主动技能选目标提示 */
export function promptChooseTarget(player, candidates = [], hint = '') {
  return {
    type: 'chooseTarget',
    player: serializePlayerPublic(player),
    candidates: (candidates || []).map(serializeTarget),
    hint,
  };
}

/** 弃牌提示 */
export function promptDiscard(player, count) {
  return {
    type: 'discard',
    player: serializePlayerPublic(player),
    cards: player.handCards.map(serializeCard),
    count,
  };
}

/** 响应牌提示（cards 已按条件过滤） */
export function promptRespond(player, filter) {
  const cards = player.handCards.filter(filter).map(serializeCard);
  return {
    type: 'respond',
    player: serializePlayerPublic(player),
    cards,
  };
}

/** 确认提示 */
export function promptConfirm(message) {
  return { type: 'confirm', message };
}

/** 效果反馈（仅传必要字段，避免玩家对象跨端） */
export function serializeEffect(effect) {
  if (!effect) return null;
  return {
    type: effect.type,
    playerId: effect.player?.id || effect.source?.id || null,
    targetId: effect.target?.id || null,
    sourceId: effect.source?.id || null,
    num: effect.num || 0,
    // 八卦阵判定结果：客户端据此显示“判定生效/判定失败”，此前遗漏导致远端永远显示生效
    success: effect.success,
    nature: effect.nature || null,
    cardName: effect.card?.name || null,
    cardType: effect.card?.type || null,
    name: effect.name || null,
    card: effect.card ? serializeCard(effect.card) : null,
  };
}
