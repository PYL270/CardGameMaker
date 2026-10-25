/**
 * 经典武将（参考三国杀经典设计，技能均带完整设置）
 * - triggerTiming / triggerSource / usable / forced：技能触发设置
 * - filter / cost / content：技能逻辑
 * - description：技能说明（选将预览、说明面板、角色卡悬停可见）
 */
export const CLASSIC_SKILLS = [
  {
    id: 'cls_jianxiong',
    name: '奸雄',
    type: 'trigger',
    description: '当你受到伤害后，你可以获得造成伤害的牌，然后摸1张牌（每回合限一次）。',
    triggerTiming: 'damaged',
    triggerSource: 'player',
    usable: 1,
    forced: false,
    filter: (event, player) => event.data?.target === player && !!event.data?.card,
    cost: async (event) => { event.result = { bool: true }; },
    content: async (event, trigger, player) => {
      const game = event.game;
      const card = event.data.card;
      if (!card || !game) return;
      game.takeCardFromDiscard(card);
      player.drawCards([card]);
      game.addLog(`${player.name} 发动【奸雄】获得了${card.name}`);
      const extra = game.deck.draw(1);
      player.drawCards(extra);
      game.addLog(`${player.name} 发动【奸雄】摸1张牌`);
    },
    ai: { order: 8, check: () => true },
  },
  {
    id: 'cls_rende',
    name: '仁德',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段限一次：将1~2张手牌交给一名其他角色；若交出2张，你摸1张牌；若你已受伤，回复1点体力。',
    usable: 1,
    forced: false,
    filter: (event, player) => player.handCards.length > 0,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const others = game.getAlivePlayers().filter(p => p !== player);
      if (others.length === 0) return;
      const maxCards = Math.min(2, player.handCards.length);
      const picked = await game.chooseCards(player, {
        min: 1,
        max: maxCards,
        hint: '【仁德】选择1~2张手牌交给其他角色',
      });
      const cards = (picked || []).slice(0, maxCards);
      if (cards.length === 0) return;
      const target = await game.chooseTarget(player, others, '【仁德】选择获得手牌的角色');
      if (!target) return;
      for (const card of cards) {
        player.discardCard(card);
        target.drawCards([card]);
      }
      game.addLog(`${player.name} 发动【仁德】将${cards.length}张手牌交给${target.name}`);
      if (cards.length >= 2) {
        const drawn = game.deck.draw(1);
        player.drawCards(drawn);
        game.addLog(`${player.name} 发动【仁德】交出2张牌，摸1张牌`);
      }
      if (player.hp < player.maxHp) {
        player.recover(1);
        game.addLog(`${player.name} 回复1点体力`);
        game.emitHeal(player, 1, player);
      }
    },
    ai: { order: 6, check: () => true },
  },
  {
    id: 'cls_zhiheng',
    name: '制衡',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段限一次：弃置任意张手牌并摸等量的牌；若弃置≥2张，额外摸1张。',
    usable: 1,
    forced: false,
    filter: (event, player) => player.handCards.length > 0,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const picked = await game.chooseCards(player, {
        min: 1,
        max: player.handCards.length,
        hint: '【制衡】选择要弃置的牌（可多选）',
      });
      if (!picked || picked.length === 0) return;
      for (const card of picked) {
        player.discardCard(card);
        game.deck.discardOne(card);
      }
      const bonus = picked.length >= 2 ? 1 : 0;
      const drawn = game.deck.draw(picked.length + bonus);
      player.drawCards(drawn);
      game.addLog(`${player.name} 发动【制衡】弃${picked.length}张，摸${drawn.length}张${bonus ? '（弃≥2额外+1）' : ''}`);
    },
    ai: { order: 7, check: () => true },
  },
  {
    id: 'cls_wusheng',
    name: '武圣',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段，你可以将一张红色手牌当【杀】使用（仍受出杀次数限制）；你使用【杀】无距离限制。',
    usable: 0,
    forced: false,
    filter: (event, player) => player.canSha && player.handCards.some(c => c.isRed),
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const picked = await game.chooseCards(player, {
        min: 1,
        max: 1,
        filter: (c) => c.isRed,
        hint: '【武圣】选择一张红色手牌当【杀】',
      });
      const card = picked?.[0];
      if (!card) return;
      const targets = game.getValidTargets(player, '杀');
      if (targets.length === 0) {
        game.addLog('没有可攻击的目标');
        return;
      }
      const target = await game.chooseTarget(player, targets, '【武圣】选择【杀】的目标');
      if (!target) return;
      player.discardCard(card);
      game.deck.discardOne(card);
      game.addLog(`${player.name} 发动【武圣】将${card.name}当【杀】使用`);
      await game.resolveShaUse(player, card, target);
    },
    ai: { order: 6, check: () => true },
  },
  {
    id: 'cls_paoxiao',
    name: '咆哮',
    type: 'locked',
    description: '锁定技，你使用【杀】没有次数限制；当你使用【杀】造成伤害后，摸1张牌（每回合限一次）。',
    triggerTiming: 'shaDamage',
    triggerSource: 'player',
    usable: 1,
    forced: true,
    filter: (event, player) => event.data?.player === player,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const cards = game.deck.draw(1);
      player.drawCards(cards);
      game.addLog(`${player.name} 发动【咆哮】造成【杀】伤害后摸1张牌`);
    },
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_kongcheng',
    name: '空城',
    type: 'locked',
    description: '锁定技，当你没有手牌时，你不能成为【杀】或【决斗】的目标；摸牌阶段若你没有手牌，额外摸1张牌。',
    triggerTiming: 'phaseDrawBegin2',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player && player.handCards.length === 0,
    cost: async () => {},
    content: async (event) => {
      event.data.num = (event.data.num || 0) + 1;
    },
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_fankui',
    name: '反馈',
    type: 'trigger',
    description: '当你受到伤害后，你可以获得伤害来源的一张手牌，然后摸1张牌（每回合限一次）。',
    triggerTiming: 'damaged',
    triggerSource: 'player',
    usable: 1,
    forced: false,
    filter: (event, player) => event.data?.target === player
      && !!event.data?.source
      && event.data.source.handCards.length > 0,
    cost: async (event) => { event.result = { bool: true }; },
    content: async (event, trigger, player) => {
      const game = event.game;
      const source = event.data.source;
      if (!source || source.handCards.length === 0) return;
      const card = source.handCards[Math.floor(Math.random() * source.handCards.length)];
      source.discardCard(card);
      player.drawCards([card]);
      game.addLog(`${player.name} 发动【反馈】获得${source.name}的一张手牌`);
      const extra = game.deck.draw(1);
      player.drawCards(extra);
      game.addLog(`${player.name} 发动【反馈】摸1张牌`);
    },
    ai: { order: 7, check: () => true },
  },
  {
    id: 'cls_yingzi',
    name: '英姿',
    type: 'locked',
    description: '锁定技，摸牌阶段你额外摸1张牌；你的手牌上限+1。',
    triggerTiming: 'phaseDrawBegin2',
    triggerSource: 'player',
    forced: true,
    usable: 0,
    filter: (event, player) => event.data?.player === player,
    cost: async () => {},
    content: async (event) => {
      event.data.num = (event.data.num || 0) + 1;
    },
    ai: { order: 10, check: () => true },
  },
  {
    id: 'cls_jizhi',
    name: '集智',
    type: 'trigger',
    description: '当你使用一张非延时锦囊牌时，你摸1张牌；若此锦囊为红色，改为摸2张牌。',
    triggerTiming: 'useCard',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player && event.data?.card?.type === 'trick',
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const num = event.data?.card?.isRed ? 2 : 1;
      const cards = game.deck.draw(num);
      player.drawCards(cards);
      game.addLog(`${player.name} 发动【集智】摸${num}张牌`);
    },
    ai: { order: 9, check: () => true },
  },
  {
    id: 'cls_biyue',
    name: '闭月',
    type: 'trigger',
    description: '结束阶段，你摸2张牌。',
    triggerTiming: 'phaseEnd',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player && event.data?.phase === 'finish',
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const cards = game.deck.draw(2);
      player.drawCards(cards);
      game.addLog(`${player.name} 发动【闭月】摸2张牌`);
    },
    ai: { order: 9, check: () => true },
  },

  /* ===== 第二技能：让每名经典武将至少拥有两条可玩路线 ===== */
  {
    id: 'cls_weiwu',
    name: '魏武',
    type: 'locked',
    description: '锁定技，你的手牌上限+1。',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async () => {},
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_renwang',
    name: '仁望',
    type: 'trigger',
    description: '锁定技，结束阶段若你的手牌数小于体力值，摸1张牌。',
    triggerTiming: 'phaseEnd',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player
      && event.data?.phase === 'finish'
      && player.handCards.length < player.hp,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      player.drawCards(game.deck.draw(1));
      game.addLog(`${player.name} 发动【仁望】摸1张牌`);
    },
    ai: { order: 8, check: () => true },
  },
  {
    id: 'cls_naxian',
    name: '纳贤',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段限一次：弃置一张手牌，令一名其他角色摸1张牌；若其与你同队，你再摸1张牌。',
    usable: 1,
    forced: false,
    filter: (event, player) => player.handCards.length > 0
      && event.game.getAlivePlayers().length > 1,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const picked = await game.chooseCards(player, {
        min: 1,
        max: 1,
        hint: '【纳贤】选择一张手牌弃置',
      });
      const card = picked?.[0];
      if (!card) return;
      const others = game.getAlivePlayers().filter(p => p !== player);
      if (others.length === 0) return;
      player.discardCard(card);
      game.deck.discardOne(card);
      game.emitDiscard(player, [card], 'cost');
      const target = await game.chooseTarget(player, others, '【纳贤】选择一名角色摸牌');
      if (!target) return;
      target.drawCards(game.deck.draw(1));
      game.addLog(`${player.name} 发动【纳贤】弃置${card.name}，令${target.name}摸1张牌`);
      if (game.teamMode !== 'ffa' && !game.isEnemy(player, target)) {
        player.drawCards(game.deck.draw(1));
        game.addLog(`${player.name} 发动【纳贤】与${target.name}同队，摸1张牌`);
      }
    },
    ai: { order: 5, check: () => true },
  },
  {
    id: 'cls_tuodao',
    name: '拖刀',
    type: 'locked',
    description: '锁定技，你的【杀】被【闪】抵消后，摸1张牌。',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async () => {},
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_dangyang',
    name: '当阳',
    type: 'locked',
    description: '锁定技，当你的体力值不大于2时，你的手牌上限+1且攻击范围+1。',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async () => {},
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_guanxing',
    name: '观星',
    type: 'trigger',
    description: '锁定技，准备阶段观看牌堆顶3张，将其中价值最高的一张置于牌堆顶，其余置于牌堆底。',
    triggerTiming: 'phaseBegin',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player
      && event.data?.phase === 'prepare',
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const pile = game.deck.cardPile;
      if (!Array.isArray(pile) || pile.length < 2) return;
      const count = Math.min(3, pile.length);
      const top = pile.splice(pile.length - count, count);
      top.sort((a, b) => (a.ai?.order || 0) - (b.ai?.order || 0));
      pile.push(...top);
      game.addLog(`${player.name} 发动【观星】调整牌堆顶${count}张`);
    },
    ai: { order: 9, check: () => true },
  },
  {
    id: 'cls_yinren',
    name: '隐忍',
    type: 'trigger',
    description: '锁定技，当你受到伤害后，若你的体力值不大于2，摸1张牌（每回合限一次）。',
    triggerTiming: 'damaged',
    triggerSource: 'player',
    usable: 1,
    forced: true,
    filter: (event, player) => event.data?.target === player
      && player.hp <= 2
      && player.isAlive,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      player.drawCards(game.deck.draw(1));
      game.addLog(`${player.name} 发动【隐忍】摸1张牌`);
    },
    ai: { order: 8, check: () => true },
  },
  {
    id: 'cls_huoji',
    name: '火计',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段限一次：弃置一张红色手牌，对攻击范围内的一名角色造成1点火焰伤害。',
    usable: 1,
    forced: false,
    filter: (event, player) => player.handCards.some(c => c.isRed)
      && event.game.getValidTargets(player, '杀').length > 0,
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const picked = await game.chooseCards(player, {
        min: 1,
        max: 1,
        filter: (c) => c.isRed,
        hint: '【火计】选择一张红色手牌弃置',
      });
      const card = picked?.[0];
      if (!card) return;
      const targets = game.getValidTargets(player, '杀');
      if (targets.length === 0) return;
      const target = await game.chooseTarget(player, targets, '【火计】选择一名目标');
      if (!target) return;
      player.discardCard(card);
      game.deck.discardOne(card);
      game.emitDiscard(player, [card], 'cost');
      game.addLog(`${player.name} 发动【火计】弃置${card.name}，对${target.name}造成火焰伤害`);
      await game.dealDamage({ source: player, target, num: 1, card, nature: 'fire', reason: 'skill' });
    },
    ai: { order: 6, check: () => true },
  },
  {
    id: 'cls_qicai',
    name: '奇才',
    type: 'locked',
    description: '锁定技，你使用【顺手牵羊】和【兵粮寸断】无距离限制。',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async () => {},
    ai: { order: 0, check: () => true },
  },
  {
    id: 'cls_lijian',
    name: '离间',
    type: 'active',
    enable: 'phaseUse',
    description: '出牌阶段限一次：弃置一张手牌并选择一名男性角色，其须弃置一张【杀】，否则受到1点伤害。',
    usable: 1,
    forced: false,
    filter: (event, player) => player.handCards.length > 0
      && event.game.getAlivePlayers().some(p => p !== player && p.character?.sex === 'male'),
    cost: async () => {},
    content: async (event, trigger, player) => {
      const game = event.game;
      const males = game.getAlivePlayers().filter(p =>
        p !== player && p.character?.sex === 'male');
      if (males.length === 0) return;
      const picked = await game.chooseCards(player, {
        min: 1,
        max: 1,
        hint: '【离间】选择一张手牌弃置',
      });
      const card = picked?.[0];
      if (!card) return;
      const target = await game.chooseTarget(player, males, '【离间】选择一名男性角色');
      if (!target) return;
      player.discardCard(card);
      game.deck.discardOne(card);
      game.emitDiscard(player, [card], 'cost');
      let sha = null;
      if (target.isAI) {
        sha = target.handCards.find(c => c.name === '杀') || null;
      } else if (game.ui.askForCard) {
        sha = (await game.ui.askForCard(target, c => c.name === '杀')) || null;
      }
      if (sha) {
        target.discardCard(sha);
        game.deck.discardOne(sha);
        game.emitDiscard(target, [sha], 'cost');
        game.addLog(`${player.name} 发动【离间】${target.name} 弃置【杀】化解`);
      } else {
        game.addLog(`${player.name} 发动【离间】${target.name} 无【杀】可弃`);
        await game.dealDamage({ source: player, target, num: 1, card, reason: 'skill' });
      }
    },
    ai: { order: 6, check: () => true },
  },
];

export const CLASSIC_CHARACTERS = [
  { id: 'cls_caocao', name: '曹操', sex: 'male', group: 'wei', hp: 4, maxHp: 4, skillIds: ['cls_jianxiong', 'cls_weiwu'], equipSlots: 3, description: '治世之能臣，乱世之奸雄；奸雄纳策，魏武驭众。' },
  { id: 'cls_liubei', name: '刘备', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_rende', 'cls_renwang'], equipSlots: 3, description: '仁德之主，以德服人；仁德济世，仁望归心。' },
  { id: 'cls_sunquan', name: '孙权', sex: 'male', group: 'wu', hp: 4, maxHp: 4, skillIds: ['cls_zhiheng', 'cls_naxian'], equipSlots: 3, description: '制衡江东，坐断东南；制衡任势，纳贤用能。' },
  { id: 'cls_guanyu', name: '关羽', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_wusheng', 'cls_tuodao'], equipSlots: 3, description: '武圣关云长，千里走单骑；武圣临阵，拖刀返身。' },
  { id: 'cls_zhangfei', name: '张飞', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_paoxiao', 'cls_dangyang'], equipSlots: 3, description: '万人之敌，当阳桥上一声断喝退曹军；咆哮破阵，当阳死守。' },
  { id: 'cls_zhugeliang', name: '诸葛亮', sex: 'male', group: 'shu', hp: 3, maxHp: 3, skillIds: ['cls_kongcheng', 'cls_guanxing'], equipSlots: 3, description: '运筹帷幄，空城退敌；空城抚琴，观星借风。' },
  { id: 'cls_simayi', name: '司马懿', sex: 'male', group: 'wei', hp: 3, maxHp: 3, skillIds: ['cls_fankui', 'cls_yinren'], equipSlots: 3, description: '隐忍负重，反馈机变；反馈制敌，隐忍待时。' },
  { id: 'cls_zhouyu', name: '周瑜', sex: 'male', group: 'wu', hp: 3, maxHp: 3, skillIds: ['cls_yingzi', 'cls_huoji'], equipSlots: 3, description: '雄姿英发，羽扇纶巾；英姿勃发，火计破曹。' },
  { id: 'cls_huangyueying', name: '黄月英', sex: 'female', group: 'shu', hp: 3, maxHp: 3, skillIds: ['cls_jizhi', 'cls_qicai'], equipSlots: 3, description: '机关巧思，集智百出；集智造器，奇才通变。' },
  { id: 'cls_diaochan', name: '貂蝉', sex: 'female', group: 'qun', hp: 3, maxHp: 3, skillIds: ['cls_biyue', 'cls_lijian'], equipSlots: 3, description: '闭月之姿，倾国倾城；闭月藏锋，离间乱敌。' },
];

/** 按技能 ID 查技能设置 */
export function getClassicSkill(skillId) {
  return CLASSIC_SKILLS.find(s => s.id === skillId) || null;
}
