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
];

export const CLASSIC_CHARACTERS = [
  { id: 'cls_caocao', name: '曹操', sex: 'male', group: 'wei', hp: 4, maxHp: 4, skillIds: ['cls_jianxiong'], equipSlots: 3, description: '治世之能臣，乱世之奸雄；纳敌之策以强己。' },
  { id: 'cls_liubei', name: '刘备', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_rende'], equipSlots: 3, description: '仁德之主，以德服人；携民渡江，终成鼎足。' },
  { id: 'cls_sunquan', name: '孙权', sex: 'male', group: 'wu', hp: 4, maxHp: 4, skillIds: ['cls_zhiheng'], equipSlots: 3, description: '制衡江东，坐断东南；任贤用能，稳据一方。' },
  { id: 'cls_guanyu', name: '关羽', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_wusheng'], equipSlots: 3, description: '武圣关云长，千里走单骑，斩颜良于万军之中。' },
  { id: 'cls_zhangfei', name: '张飞', sex: 'male', group: 'shu', hp: 4, maxHp: 4, skillIds: ['cls_paoxiao'], equipSlots: 3, description: '万人之敌，当阳桥上一声断喝退曹军。' },
  { id: 'cls_zhugeliang', name: '诸葛亮', sex: 'male', group: 'shu', hp: 3, maxHp: 3, skillIds: ['cls_kongcheng'], equipSlots: 3, description: '运筹帷幄，空城退敌；鞠躬尽瘁，死而后已。' },
  { id: 'cls_simayi', name: '司马懿', sex: 'male', group: 'wei', hp: 3, maxHp: 3, skillIds: ['cls_fankui'], equipSlots: 3, description: '隐忍负重，反馈机变；熬死诸葛，终掌魏权。' },
  { id: 'cls_zhouyu', name: '周瑜', sex: 'male', group: 'wu', hp: 3, maxHp: 3, skillIds: ['cls_yingzi'], equipSlots: 3, description: '雄姿英发，羽扇纶巾；赤壁一炬，谈笑破曹。' },
  { id: 'cls_huangyueying', name: '黄月英', sex: 'female', group: 'shu', hp: 3, maxHp: 3, skillIds: ['cls_jizhi'], equipSlots: 3, description: '机关巧思，集智百出；木牛流马，皆出其手。' },
  { id: 'cls_diaochan', name: '貂蝉', sex: 'female', group: 'qun', hp: 3, maxHp: 3, skillIds: ['cls_biyue'], equipSlots: 3, description: '闭月之姿，倾国倾城；连环计成，董卓授首。' },
];

/** 按技能 ID 查技能设置 */
export function getClassicSkill(skillId) {
  return CLASSIC_SKILLS.find(s => s.id === skillId) || null;
}
