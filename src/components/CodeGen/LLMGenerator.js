/**
 * LLMGenerator - 大语言模型代码生成器
 * 调用外部AI API，根据自然语言描述生成游戏代码
 */

import { loadLLMConfig } from '../../core/secureStore';

/**
 * 从加密存储读取LLM配置（自动兼容旧版明文并迁移）
 */
async function getLLMConfig() {
  try {
    return await loadLLMConfig();
  } catch (err) {
    console.warn('[LLMGenerator] 读取 LLM 配置失败，按空配置处理', err);
    return {};
  }
}

/**
 * 调用LLM API生成代码
 * @param {string} prompt - 用户的自然语言描述
 * @returns {Promise<string>} 生成的代码
 */
export async function generateLLMCode(prompt) {
  const config = await getLLMConfig();

  if (!config.apiKey || !config.apiUrl) {
    // 没有配置API时，使用内置的规则映射+模板生成
    return generateByLocalRules(prompt);
  }

  // 构建系统提示
  const systemPrompt = buildSystemPrompt();

  // 调用API
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const code = data.choices?.[0]?.message?.content || '';

    // 提取代码块(如果AI返回了markdown代码块)
    return extractCodeBlock(code);
  } catch (error) {
    console.error('LLM API调用失败:', error);
    // 降级到本地规则
    return generateByLocalRules(prompt);
  }
}

/**
 * 构建系统提示(告诉AI如何生成代码)
 */
function buildSystemPrompt() {
  return `你是CardGameMaker(类三国杀卡牌游戏框架)的代码生成AI。

用户会描述一个游戏技能或武将，你需要生成对应的JavaScript代码。

## 可用的类和常量:
- Game: 游戏控制器(game对象在content中可用)
- Player: 玩家类(属性: hp, maxHp, handCards, skills, equips, judgeCards)
- Card: 卡牌类(属性: name, suit, number, type)
- Skill: 技能类
- Character: 武将类

## 技能结构(Skill):
{
  id: "skill_id",       // 内部ID
  name: "技能名",       // 显示名
  type: "trigger",      // 类型: active/trigger/locked/limited
  description: "描述",
  triggerTiming: "damaged", // 触发时机
  triggerSource: "player",  // 触发源: player/global/target
  usable: 1,            // 每回合可用次数
  forced: false,        // 是否锁定
  filter(event, player) { return true; },
  cost(event, trigger, player) { event.result = {bool: true}; },
  content(event, trigger, player) { /* 效果 */ },
  ai: { order: 6, result: { player: 1, target: () => 0 }, check: () => true },
}

## 触发时机:
roundStart/roundEnd/phaseBegin/phaseEnd/phaseDrawBegin2/phaseUseBegin/
phaseDiscardBegin/damageBegin/damageEnd/damaged/recover/die/dieAfter/
useCard/discardCard/gainCard/loseCard/equip/unequip/judge

## game对象常用方法:
- game.deck.draw(n) - 从牌堆摸n张牌
- game.addLog(msg) - 添加日志
- game.getAlivePlayers() - 获取存活玩家
- game.distance.getShaTargets(player) - 获取出杀目标
- game.emit(event, data) - 触发事件

## player对象常用方法:
- player.drawCards(cards) - 获得牌
- player.discardCard(card) - 弃牌
- player.damage(n) - 受到伤害
- player.recover(n) - 回复体力
- player.setStorage(key, value) - 设置标记
- player.getStorage(key) - 获取标记

请只生成JavaScript代码，不要解释。代码应该能直接运行。`;
}

/**
 * 从AI返回的内容中提取代码块
 */
function extractCodeBlock(text) {
  // 尝试提取 ```javascript 或 ``` 代码块
  const codeBlockMatch = text.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // 如果没有代码块标记，返回全文(去除可能的注释)
  return text.trim();
}

/**
 * 本地规则生成(不依赖API的降级方案)
 * 通过关键词匹配生成基础技能代码
 */
function generateByLocalRules(prompt) {
  const lines = [];
  lines.push(`// 由本地规则生成(未配置AI API)`);
  lines.push(`// 原始描述: ${prompt}`);
  lines.push('');

  // 分析关键词
  const isDraw = /摸牌|摸.*张/.test(prompt);
  const isDamage = /伤害|受伤|受到/.test(prompt);
  const isRecover = /回复|恢复|回血/.test(prompt);
  const isDiscard = /弃牌|弃置/.test(prompt);
  const isKill = /出杀|使用杀/.test(prompt);
  const isDodge = /出闪|使用闪/.test(prompt);
  const isPeach = /出桃|使用桃/.test(prompt);

  // 提取数字
  const numMatch = prompt.match(/(\d+)张/);
  const num = numMatch ? parseInt(numMatch[1]) : 1;

  // 提取技能名(引号内或"XXX技")
  const nameMatch = prompt.match(/[""'](.+?)[""']/) || prompt.match(/(?:创建|定义|一个)(.{1,6})(?:技|能)/);
  const skillName = nameMatch ? nameMatch[1] : '自定义技能';

  // 判断触发时机
  let timing = 'phaseDrawBegin2';
  let triggerLabel = '摸牌阶段';
  if (isDamage && /后|时/.test(prompt)) {
    timing = 'damaged';
    triggerLabel = '受伤后';
  } else if (isDamage) {
    timing = 'damageBegin';
    triggerLabel = '伤害开始';
  } else if (/回合.*始|开局/.test(prompt)) {
    timing = 'roundStart';
    triggerLabel = '回合开始';
  } else if (/出牌阶段|出牌时/.test(prompt)) {
    timing = 'phaseUseBegin';
    triggerLabel = '出牌阶段';
  }

  // 生成代码
  lines.push(`const skill_${Date.now()} = new Skill({`);
  lines.push(`  id: "skill_auto_${Date.now()}",`);
  lines.push(`  name: "${skillName}",`);
  lines.push(`  type: "${isKill || isDodge || isPeach ? 'active' : 'trigger'}",`);
  lines.push(`  description: "${prompt.replace(/"/g, '\\"')}",`);
  lines.push(`  triggerTiming: "${timing}",`);
  lines.push(`  triggerSource: "player",`);
  lines.push(`  usable: 1,`);
  lines.push(`  forced: false,`);

  // filter
  lines.push(`  filter: function(event, player) {`);
  if (isKill) {
    lines.push(`    return player.handCards.some(c => c.name === "杀");`);
  } else if (isDodge) {
    lines.push(`    return player.handCards.some(c => c.name === "闪");`);
  } else {
    lines.push(`    return true;`);
  }
  lines.push(`  },`);

  // cost
  lines.push(`  cost: async function(event, trigger, player) {`);
  lines.push(`    event.result = { bool: true };`);
  lines.push(`  },`);

  // content
  lines.push(`  content: async function(event, trigger, player) {`);
  if (isDraw) {
    lines.push(`    // 摸${num}张牌`);
    lines.push(`    const cards = game.deck.draw(${num});`);
    lines.push(`    player.drawCards(cards);`);
    lines.push(`    game.addLog(player.name + "发动${skillName}，摸了${num}张牌");`);
  } else if (isDamage) {
    lines.push(`    // 造成${num}点伤害`);
    lines.push(`    const targets = game.distance.getOtherAlivePlayers(player);`);
    lines.push(`    if (targets.length > 0) {`);
    lines.push(`      targets[0].damage(${num});`);
    lines.push(`      game.addLog(player.name + "发动${skillName}，对" + targets[0].name + "造成${num}点伤害");`);
    lines.push(`    }`);
  } else if (isRecover) {
    lines.push(`    // 回复${num}点体力`);
    lines.push(`    player.recover(${num});`);
    lines.push(`    game.addLog(player.name + "发动${skillName}，回复${num}点体力");`);
  } else if (isKill) {
    lines.push(`    // 出杀`);
    lines.push(`    const sha = player.handCards.find(c => c.name === "杀");`);
    lines.push(`    if (sha) {`);
    lines.push(`      const targets = game.distance.getShaTargets(player);`);
    lines.push(`      if (targets.length > 0) {`);
    lines.push(`        player.discardCard(sha);`);
    lines.push(`        game.addLog(player.name + "发动${skillName}，对" + targets[0].name + "使用杀");`);
    lines.push(`      }`);
    lines.push(`    }`);
  } else {
    lines.push(`    // TODO: 在此编写技能效果`);
    lines.push(`    game.addLog(player.name + "发动了${skillName}");`);
  }
  lines.push(`  },`);

  // AI
  lines.push(`  ai: {`);
  lines.push(`    order: 6,`);
  lines.push(`    result: { player: 1, target: function(player, target) { return 0; } },`);
  lines.push(`    check: function(event, player) { return true; },`);
  lines.push(`  },`);

  lines.push(`});`);
  lines.push('');

  lines.push(`// 注册到游戏`);
  lines.push(`// game.registerSkill(skill_${Date.now()});`);

  return lines.join('\n');
}
