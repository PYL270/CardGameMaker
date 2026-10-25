/**
 * 技能描述语义分词：纯函数，按固定优先级匹配，保证不丢字、不重叠。
 * 优先级：牌名【】→ 类型词 → 频率 → 时机 → 效果 → 数字 → 普通文本。
 */

export const SKILL_KEYWORD_GROUPS = [
  { type: 'limited', label: '限定技', tone: '红', sample: '限定技', desc: '每局一次的大招' },
  { type: 'awakening', label: '觉醒技', tone: '橙', sample: '觉醒技', desc: '满足条件后觉醒' },
  { type: 'locked', label: '锁定技', tone: '金', sample: '锁定技', desc: '自动生效、不询问' },
  { type: 'mission', label: '使命技', tone: '紫', sample: '使命技', desc: '完成/失败使命' },
  { type: 'transform', label: '转换技', tone: '青', sample: '转换技', desc: '阴阳状态轮换' },
  { type: 'frequency', label: '发动频率', tone: '黄', sample: '每回合限一次', desc: '每回合/每轮/每阶段/每局' },
  { type: 'timing', label: '触发时机', tone: '青', sample: '受到伤害后', desc: '阶段/时机/目标时' },
  { type: 'card', label: '牌名', tone: '金', sample: '【杀】', desc: '【】内的牌名' },
  { type: 'effect', label: '效果动词', tone: '绿', sample: '摸1张牌', desc: '摸牌/伤害/回复/判定等' },
  { type: 'number', label: '数值', tone: '暖', sample: '2', desc: '阿拉伯数字' },
];

const TYPE_WORDS = [
  ['限定技', 'limited'],
  ['觉醒技', 'awakening'],
  ['锁定技', 'locked'],
  ['使命技', 'mission'],
  ['转换技', 'transform'],
];

const CARD_RE = /^【[^】]{1,16}】/;
const FREQUENCY_RE = /^每(?:回合|轮|阶段|局)(?:限(?:一|1|两|2|三|3)次|(?:一|1|两|2|三|3)次)/;
const TIMING_RE = /^(?:出牌阶段开始时|摸牌阶段开始时|判定阶段开始时|弃牌阶段开始时|准备阶段开始时|结束阶段开始时|出牌阶段|摸牌阶段|判定阶段|弃牌阶段|准备阶段|结束阶段|回合开始时|回合结束时|受到伤害后|造成伤害后|使用【[^】]{1,8}】时|成为[^，。；]{1,12}目标时|进入濒死状态时|濒死时|响应时|判定牌生效前)/;
const EFFECT_RE = /^(?:摸(?:[0-9]+|一|两|二|三|X)张牌|摸一张牌|摸牌|回复(?:[0-9]+|一|两|二|三|X)点体力|回复体力|造成(?:[0-9]+|一|两|二|三|X)点伤害|造成伤害|防止(?:此)?伤害|视为使用|获得(?:造成伤害的牌|一张牌|牌)?|交给|进行判定|判定|翻面|失去(?:[0-9]+|一|两|二|三|X)点体力|弃置(?:[0-9]+|一|两|二|三|X)?张?(?:手牌|牌)?)/;
const NUMBER_RE = /^[0-9]+/;

/**
 * @param {string} text
 * @returns {Array<{text:string,type:string}>}
 */
export function tokenizeSkillText(text) {
  const source = String(text ?? '');
  if (!source) return [];
  const tokens = [];
  let plain = '';
  let i = 0;
  const flushPlain = () => {
    if (plain) {
      tokens.push({ text: plain, type: 'plain' });
      plain = '';
    }
  };
  const push = (value, type) => {
    flushPlain();
    tokens.push({ text: value, type });
    i += value.length;
  };

  while (i < source.length) {
    const rest = source.slice(i);

    const card = rest.match(CARD_RE);
    if (card) { push(card[0], 'card'); continue; }

    const typeWord = TYPE_WORDS.find(([word]) => rest.startsWith(word));
    if (typeWord) { push(typeWord[0], typeWord[1]); continue; }

    const frequency = rest.match(FREQUENCY_RE);
    if (frequency) { push(frequency[0], 'frequency'); continue; }

    const timing = rest.match(TIMING_RE);
    if (timing) { push(timing[0], 'timing'); continue; }

    const effect = rest.match(EFFECT_RE);
    if (effect) { push(effect[0], 'effect'); continue; }

    const number = rest.match(NUMBER_RE);
    if (number) { push(number[0], 'number'); continue; }

    plain += source[i];
    i += 1;
  }
  flushPlain();
  return tokens;
}

/** token 重组（测试/调试用）：必须等于原文 */
export function joinSkillTokens(tokens) {
  return (Array.isArray(tokens) ? tokens : []).map(token => token?.text || '').join('');
}
