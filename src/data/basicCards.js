/**
 * basicCards - 标准牌堆定义
 * 包含所有基本牌、锦囊牌、延时锦囊和装备牌
 */
import Card, { CARD_TYPES, EQUIP_SLOTS, SUITS } from '../core/Card';

/**
 * 生成指定花色和点数范围的牌
 */
function makeCards(name, type, suit, numbers, extra = {}) {
  return numbers.map(n => new Card({ name, suit, number: n, type, ...extra }));
}

/**
 * 生成四种花色的牌
 */
function makeQuad(name, type, numbers, extra = {}) {
  const cards = [];
  for (const suit of SUITS) {
    cards.push(...makeCards(name, type, suit, numbers, extra));
  }
  return cards;
}

/**
 * 构建标准牌堆（传统四花色 + 日曜/月华扩展花色）
 */
export function buildStandardDeck() {
  const pile = [];

  // ===== 基本牌 =====
  // 杀: 黑桃/梅花/红桃/方块各分布
  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'spade', [7, 8, 8, 9, 9, 10, 10]));
  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'club', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'heart', [10, 10, 11]));
  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'diamond', [6, 7, 8, 9, 10, 13]));

  // 闪
  pile.push(...makeCards('闪', CARD_TYPES.BASIC, 'heart', [2, 2, 8, 9, 11, 12]));
  pile.push(...makeCards('闪', CARD_TYPES.BASIC, 'diamond', [2, 2, 3, 4, 5, 6, 7, 8, 11]));

  // 桃
  pile.push(...makeCards('桃', CARD_TYPES.BASIC, 'heart', [3, 4, 6, 7, 8, 9, 12]));
  pile.push(...makeCards('桃', CARD_TYPES.BASIC, 'diamond', [12]));

  // 酒
  pile.push(...makeCards('酒', CARD_TYPES.BASIC, 'spade', [3, 9]));
  pile.push(...makeCards('酒', CARD_TYPES.BASIC, 'club', [3, 9]));
  pile.push(...makeCards('酒', CARD_TYPES.BASIC, 'diamond', [9]));

  // ===== 锦囊牌 =====
  // 决斗: 3张
  pile.push(new Card({ name: '决斗', suit: 'spade', number: 1, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '决斗', suit: 'club', number: 1, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '决斗', suit: 'diamond', number: 1, type: CARD_TYPES.TRICK }));

  // 南蛮入侵: 3张
  pile.push(new Card({ name: '南蛮入侵', suit: 'spade', number: 7, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '南蛮入侵', suit: 'spade', number: 13, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '南蛮入侵', suit: 'club', number: 7, type: CARD_TYPES.TRICK }));

  // 万箭齐发: 1张
  pile.push(new Card({ name: '万箭齐发', suit: 'heart', number: 1, type: CARD_TYPES.TRICK }));

  // 桃园结义: 1张
  pile.push(new Card({ name: '桃园结义', suit: 'heart', number: 1, type: CARD_TYPES.TRICK }));

  // 无懈可击: 4张
  pile.push(new Card({ name: '无懈可击', suit: 'spade', number: 11, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无懈可击', suit: 'diamond', number: 12, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无懈可击', suit: 'club', number: 12, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无懈可击', suit: 'heart', number: 13, type: CARD_TYPES.TRICK }));

  // 顺手牵羊: 5张
  pile.push(new Card({ name: '顺手牵羊', suit: 'spade', number: 3, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '顺手牵羊', suit: 'spade', number: 4, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '顺手牵羊', suit: 'spade', number: 11, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '顺手牵羊', suit: 'diamond', number: 3, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '顺手牵羊', suit: 'diamond', number: 4, type: CARD_TYPES.TRICK }));

  // 过河拆桥: 6张
  pile.push(new Card({ name: '过河拆桥', suit: 'spade', number: 3, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'spade', number: 4, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'spade', number: 12, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'club', number: 3, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'club', number: 4, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'heart', number: 12, type: CARD_TYPES.TRICK }));

  // 无中生有: 4张
  pile.push(new Card({ name: '无中生有', suit: 'heart', number: 7, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无中生有', suit: 'heart', number: 8, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无中生有', suit: 'heart', number: 9, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无中生有', suit: 'heart', number: 11, type: CARD_TYPES.TRICK }));

  // ===== 延时锦囊 =====
  // 乐不思蜀: 3张
  pile.push(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: CARD_TYPES.DELAY_TRICK }));
  pile.push(new Card({ name: '乐不思蜀', suit: 'heart', number: 6, type: CARD_TYPES.DELAY_TRICK }));
  pile.push(new Card({ name: '乐不思蜀', suit: 'club', number: 6, type: CARD_TYPES.DELAY_TRICK }));

  // 兵粮寸断: 2张
  pile.push(new Card({ name: '兵粮寸断', suit: 'spade', number: 10, type: CARD_TYPES.DELAY_TRICK }));
  pile.push(new Card({ name: '兵粮寸断', suit: 'club', number: 10, type: CARD_TYPES.DELAY_TRICK }));

  // 闪电: 2张
  pile.push(new Card({ name: '闪电', suit: 'spade', number: 1, type: CARD_TYPES.DELAY_TRICK }));
  pile.push(new Card({ name: '闪电', suit: 'club', number: 12, type: CARD_TYPES.DELAY_TRICK }));

  // ===== 扩展花色：日曜 / 月华 =====
  // 在传统四花色之外增加两种花色，让牌堆的花色构成更丰富；判定规则仍按原花色文本生效
  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'sun', [2, 6, 10]));
  pile.push(...makeCards('闪', CARD_TYPES.BASIC, 'sun', [3, 7, 11]));
  pile.push(...makeCards('桃', CARD_TYPES.BASIC, 'sun', [4, 8]));
  pile.push(...makeCards('酒', CARD_TYPES.BASIC, 'sun', [5]));
  pile.push(new Card({ name: '决斗', suit: 'sun', number: 5, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无中生有', suit: 'sun', number: 9, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '顺手牵羊', suit: 'sun', number: 12, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '万箭齐发', suit: 'sun', number: 13, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '桃园结义', suit: 'sun', number: 1, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无懈可击', suit: 'sun', number: 11, type: CARD_TYPES.TRICK }));

  pile.push(...makeCards('杀', CARD_TYPES.BASIC, 'moon', [3, 7, 11]));
  pile.push(...makeCards('闪', CARD_TYPES.BASIC, 'moon', [4, 8, 12]));
  pile.push(...makeCards('桃', CARD_TYPES.BASIC, 'moon', [5, 9]));
  pile.push(...makeCards('酒', CARD_TYPES.BASIC, 'moon', [5]));
  pile.push(new Card({ name: '决斗', suit: 'moon', number: 6, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '南蛮入侵', suit: 'moon', number: 10, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无中生有', suit: 'moon', number: 9, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '过河拆桥', suit: 'moon', number: 12, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '桃园结义', suit: 'moon', number: 1, type: CARD_TYPES.TRICK }));
  pile.push(new Card({ name: '无懈可击', suit: 'moon', number: 13, type: CARD_TYPES.TRICK }));

  // 新花色的装备，展示不同花色在装备区/牌面的颜色
  pile.push(new Card({ name: '八卦阵', suit: 'sun', number: 3, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.ARMOR }));
  pile.push(new Card({ name: '赤兔', suit: 'moon', number: 6, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_ATK }));

  // ===== 装备牌 =====
  // 武器
  const weapons = [
    { name: '诸葛连弩', suit: 'club', number: 1, range: 1 },
    { name: '诸葛连弩', suit: 'diamond', number: 1, range: 1 },
    { name: '青釭剑', suit: 'spade', number: 6, range: 2 },
    { name: '雌雄双股剑', suit: 'spade', number: 2, range: 2 },
    { name: '寒冰剑', suit: 'spade', number: 2, range: 2 },
    { name: '青龙偃月刀', suit: 'spade', number: 5, range: 3 },
    { name: '丈八蛇矛', suit: 'spade', number: 3, range: 3 },
    { name: '贯石斧', suit: 'diamond', number: 5, range: 3 },
    { name: '方天画戟', suit: 'diamond', number: 12, range: 4 },
    { name: '麒麟弓', suit: 'heart', number: 5, range: 5 },
  ];
  for (const w of weapons) {
    pile.push(new Card({
      name: w.name, suit: w.suit, number: w.number,
      type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.WEAPON, range: w.range,
    }));
  }

  // 防具
  pile.push(new Card({ name: '八卦阵', suit: 'spade', number: 2, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.ARMOR }));
  pile.push(new Card({ name: '八卦阵', suit: 'club', number: 2, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.ARMOR }));

  // 防御马(+1)
  pile.push(new Card({ name: '绝影', suit: 'spade', number: 5, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_DEF }));
  pile.push(new Card({ name: '的卢', suit: 'club', number: 5, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_DEF }));
  pile.push(new Card({ name: '爪黄飞电', suit: 'heart', number: 13, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_DEF }));

  // 进攻马(-1)
  pile.push(new Card({ name: '赤兔', suit: 'heart', number: 5, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_ATK }));
  pile.push(new Card({ name: '大宛', suit: 'spade', number: 13, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_ATK }));
  pile.push(new Card({ name: '紫骍', suit: 'diamond', number: 13, type: CARD_TYPES.EQUIP, subtype: EQUIP_SLOTS.HORSE_ATK }));

  return pile;
}

