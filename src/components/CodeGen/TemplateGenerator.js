/**
 * TemplateGenerator - 模板代码生成器
 * 根据用户定义的武将和技能，生成可直接使用的游戏代码
 */
import { SKILL_TYPES, TRIGGER_TIMINGS } from '../../core/Skill';
import { GROUP_NAMES } from '../../core/Character';

const SKILL_TYPE_LABELS = {
  active: '主动技', trigger: '触发技', locked: '锁定技',
  limited: '限定技', awakening: '觉醒技', epic: '史诗技', master: '主公技',
};

/**
 * 生成武将+技能的完整代码
 * @param {Character|null} character
 * @param {Skill[]} skills
 * @returns {string}
 */
export function generateTemplateCode(character, skills) {
  const parts = [];

  // 文件头
  parts.push(`// ==========================================`);
  parts.push(`// CardGameMaker - 自动生成的游戏代码`);
  parts.push(`// 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  parts.push(`// ==========================================`);
  parts.push('');

  // 技能代码
  if (skills.length > 0) {
    parts.push('// ===== 技能定义 =====');
    for (const skill of skills) {
      parts.push(generateSkillCode(skill));
      parts.push('');
    }
  }

  // 武将代码
  if (character) {
    parts.push('// ===== 武将定义 =====');
    parts.push(generateCharacterCode(character, skills));
    parts.push('');
  }

  // 注册代码
  parts.push('// ===== 注册到游戏 =====');
  parts.push(generateRegistrationCode(character, skills));
  parts.push('');

  // 使用说明
  parts.push(generateUsageGuide(character, skills));

  return parts.join('\n');
}

/**
 * 生成单个技能的代码
 */
function generateSkillCode(skill) {
  const lines = [];
  lines.push(`const ${toVarName(skill.id)} = new Skill({`);
  lines.push(`  id: "${skill.id}",`);
  lines.push(`  name: "${skill.name}",`);
  lines.push(`  type: SkillTypes.${skill.type.toUpperCase()},`);

  if (skill.description) {
    lines.push(`  description: "${skill.description}",`);
  }

  // 触发技特有字段
  if (skill.type === 'trigger' || skill.type === 'locked') {
    if (skill.triggerTiming) {
      lines.push(`  triggerTiming: "${skill.triggerTiming}",`);
    }
    if (skill.triggerSource) {
      lines.push(`  triggerSource: "${skill.triggerSource}",`);
    }
  }

  // 使用次数
  if (skill.usable !== undefined) {
    lines.push(`  usable: ${skill.usable},`);
  }

  // 锁定
  if (skill.forced) {
    lines.push(`  forced: true,`);
  }

  // filter
  lines.push(`  filter: function(event, player) {`);
  lines.push(`    ${skill.filterCode || 'return true;'}`);
  lines.push(`  },`);

  // cost
  lines.push(`  cost: async function(event, trigger, player) {`);
  lines.push(`    ${skill.costCode || 'event.result = { bool: true };'}`);
  lines.push(`  },`);

  // content
  lines.push(`  content: async function(event, trigger, player) {`);
  lines.push(`    ${skill.contentCode || '// 技能效果'}`);
  lines.push(`  },`);

  // AI
  lines.push(`  ai: {`);
  lines.push(`    order: ${skill.ai?.order || 0},`);
  lines.push(`    result: {`);
  lines.push(`      player: 1,`);
  lines.push(`      target: function(player, target) { return 0; },`);
  lines.push(`    },`);
  lines.push(`    check: function(event, player) {`);
  lines.push(`      ${skill.aiCheckCode || 'return true;'}`);
  lines.push(`    },`);
  lines.push(`  },`);

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * 生成武将注册代码
 */
function generateCharacterCode(character, skills) {
  const lines = [];
  lines.push(`const ${toVarName(character.id)} = new Character({`);
  lines.push(`  id: "${character.id}",`);
  lines.push(`  name: "${character.name}",`);
  lines.push(`  sex: "${character.sex}",`);
  lines.push(`  group: "${character.group}",`);
  lines.push(`  hp: ${character.hp},`);
  lines.push(`  maxHp: ${character.maxHp},`);
  lines.push(`  skillIds: [${character.skillIds.map(id => `"${id}"`).join(', ')}],`);

  if (character.description) {
    lines.push(`  description: "${character.description}",`);
  }
  if (character.imageUrl) {
    lines.push(`  imageUrl: "${character.imageUrl}",`);
  }

  lines.push(`});`);

  return lines.join('\n');
}

/**
 * 生成注册代码
 */
function generateRegistrationCode(character, skills) {
  const lines = [];

  for (const skill of skills) {
    lines.push(`game.registerSkill(${toVarName(skill.id)});`);
  }
  if (character) {
    lines.push(`game.registerCharacter(${toVarName(character.id)});`);
  }

  return lines.join('\n');
}

/**
 * 生成使用说明
 */
function generateUsageGuide(character, skills) {
  const lines = [];
  lines.push(`// ==========================================`);
  lines.push(`// 使用说明`);
  lines.push(`// ==========================================`);
  lines.push(`// 1. 将此代码复制到游戏代码编辑区`);
  lines.push(`// 2. 或保存为 .js 文件后通过扩展系统加载`);
  lines.push(`// 3. 武将和技能会自动注册到游戏中`);
  lines.push('');
  if (character) {
    lines.push(`// 武将: ${character.name} (${GROUP_NAMES[character.group]})`);
    lines.push(`// 体力: ${character.hp}/${character.maxHp}`);
    lines.push(`// 技能: ${character.skillIds.join(', ') || '无'}`);
  }
  if (skills.length > 0) {
    lines.push(`// 技能列表:`);
    for (const s of skills) {
      lines.push(`//   - ${s.name} (${SKILL_TYPE_LABELS[s.type] || s.type})`);
      if (s.description) lines.push(`//     ${s.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * 变量名转换
 */
function toVarName(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

/**
 * 快速生成常用技能模板
 */
export function getCommonSkillTemplates() {
  return [
    {
      name: '摸牌技',
      description: '摸牌阶段额外摸X张牌',
      type: SKILL_TYPES.TRIGGER,
      triggerTiming: TRIGGER_TIMINGS.PHASE_DRAW_BEGIN2,
      filterCode: 'return true;',
      costCode: 'event.result = { bool: true };',
      contentCode: '// 额外摸1张牌\nconst cards = game.deck.draw(1);\nplayer.drawCards(cards);\ngame.addLog(player.name + "发动技能额外摸了1张牌");',
    },
    {
      name: '伤害技',
      description: '造成伤害时伤害+1',
      type: SKILL_TYPES.TRIGGER,
      triggerTiming: TRIGGER_TIMINGS.DAMAGE_BEGIN,
      filterCode: 'return event.data && event.data.source === player;',
      costCode: 'event.result = { bool: true };',
      contentCode: '// 伤害+1\nevent.data.num = (event.data.num || 1) + 1;\ngame.addLog(player.name + "发动技能，伤害+1");',
    },
    {
      name: '卖血技',
      description: '受到伤害后摸X张牌',
      type: SKILL_TYPES.TRIGGER,
      triggerTiming: TRIGGER_TIMINGS.DAMAGED,
      filterCode: 'return true;',
      costCode: 'event.result = { bool: true };',
      contentCode: '// 受伤后摸2张牌\nconst cards = game.deck.draw(2);\nplayer.drawCards(cards);\ngame.addLog(player.name + "受伤后发动技能，摸了2张牌");',
    },
    {
      name: '出杀技',
      description: '出牌阶段可以额外出一次杀',
      type: SKILL_TYPES.ACTIVE,
      triggerTiming: '',
      filterCode: 'return player.canSha && player.handCards.some(c => c.name === "杀");',
      costCode: '// 选择一张杀\nconst sha = player.handCards.find(c => c.name === "杀");\nif (sha) {\n  player.discardCard(sha);\n  event.result = { bool: true, card: sha };\n}',
      contentCode: '// 选择目标出杀\nconst targets = game.distance.getShaTargets(player);\nif (targets.length > 0) {\n  const target = targets[0];\n  await game.executeCardAction(player, { card: event.result.card, targets: [target] });\n}',
    },
    {
      name: '免伤技',
      description: '受到伤害时可以防止伤害',
      type: SKILL_TYPES.TRIGGER,
      triggerTiming: TRIGGER_TIMINGS.DAMAGE_BEGIN,
      filterCode: 'return event.data && event.data.target === player;',
      costCode: 'event.result = { bool: true };',
      contentCode: '// 防止伤害\nevent.cancel();\ngame.addLog(player.name + "发动技能，防止了伤害");',
    },
  ];
}
