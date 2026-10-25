/**
 * Player - 玩家类
 * 包含武将、体力、手牌、装备、判定区、技能等
 */
import Card, { CARD_TYPES, EQUIP_SLOTS } from './Card';

export const PLAYER_STATUS = {
  ALIVE: 'alive',
  DYING: 'dying',
  DEAD: 'dead',
};

let _playerIdCounter = 0;

/** 装备栏数量规范化：1~6，非法/缺省回退 3 */
function normalizeEquipLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.min(6, Math.max(1, Math.floor(n)));
}

export default class Player {
  /**
   * @param {object} config
   * @param {string} config.name - 显示名
   * @param {boolean} config.isAI - 是否AI
   * @param {number} config.seatNum - 座位号
   */
  constructor(config = {}) {
    this.id = `player_${++_playerIdCounter}`;
    this.name = config.name || `玩家${this.id}`;
    this.isAI = config.isAI ?? true;
    this.seatNum = config.seatNum ?? 0;
    this.isOnline = true;
    // 组队/阵营：ffa 为 null；2v2/3v3 为 0 或 1（由 Game.init 按配置分配）
    this.team = config.team ?? null;

    // 武将
    this.character = null;

    // 体力
    this.hp = 0;
    this.maxHp = 0;
    this.hujia = 0; // 护甲值

    // 手牌
    this.handCards = [];

    // 装备区：通用槽 {slot1:null,...slotN:null}，数量由武将 equipSlots 决定（默认 3）
    this.equipLimit = 3;
    this.equips = {};
    this._ensureEquipSlots();

    // 判定区(延时锦囊)
    this.judgeCards = [];

    // 技能(实例化的Skill引用)
    this.skills = [];

    // 状态
    this.status = PLAYER_STATUS.ALIVE;
    this.isTurnedOver = false; // 翻面
    this.isLinked = false;     // 连环
    this.isChained = false;    // 铁索连环

    // 标记(storage系统)
    this.storage = new Map();

    // 回合内使用记录
    this.usedSha = 0;        // 本回合出杀次数
    this.usedJiu = false;    // 本回合酒效果
    this.usedJiuCount = 0;   // 本回合使用酒的次数
    this.skillUsedThisTurn = new Map(); // 技能本回合使用次数

    // 距离修正
    this.distanceFix = 0;
  }

  /**
   * 设置武将
   */
  setCharacter(character) {
    this.character = character;
    this.hp = character.hp;
    this.maxHp = character.maxHp;
    this.equipLimit = normalizeEquipLimit(character?.equipSlots);
    this._ensureEquipSlots();
  }

  /**
   * 确保通用装备槽存在（slot1..slotN），并把旧版按 subtype 命名的槽迁移到通用槽。
   * 旧存档/旧自定义武将没有 equipSlots 时按 3 槽处理。
   */
  _ensureEquipSlots() {
    if (!this.equips || typeof this.equips !== 'object') this.equips = {};
    this.equipLimit = normalizeEquipLimit(this.equipLimit);
    const legacyKeys = [EQUIP_SLOTS.WEAPON, EQUIP_SLOTS.ARMOR, EQUIP_SLOTS.HORSE_DEF, EQUIP_SLOTS.HORSE_ATK];
    for (const key of legacyKeys) {
      if (!Object.prototype.hasOwnProperty.call(this.equips, key)) continue;
      const card = this.equips[key];
      delete this.equips[key];
      if (card) {
        const empty = this.getEmptyEquipSlot();
        if (empty) this.equips[empty] = card;
      }
    }
    for (let i = 1; i <= this.equipLimit; i++) {
      const slot = `slot${i}`;
      if (!Object.prototype.hasOwnProperty.call(this.equips, slot)) this.equips[slot] = null;
    }
  }

  /**
   * 获取攻击范围(基础1 + 武器范围)
   */
  getAttackRange() {
    const weapon = this.getWeapon();
    let range = weapon ? (weapon.range || 1) : 1;
    if ((this.skills || []).some(s => s.id === 'cls_dangyang') && this.hp <= 2) range += 1;
    return range;
  }

  /**
   * 获取防御距离(基础0 + 防御马)
   */
  getDefenseDistance() {
    return this.getEquipByType(EQUIP_SLOTS.HORSE_DEF) ? 1 : 0;
  }

  /**
   * 获取进攻距离修正(进攻马 -1)
   */
  getAttackDistanceFix() {
    const fix = this.getEquipByType(EQUIP_SLOTS.HORSE_ATK) ? -1 : 0;
    return fix + this.distanceFix;
  }

  /**
   * 获取手牌数
   */
  get handCardCount() {
    return this.handCards.length;
  }

  /**
   * 手牌上限（弃牌阶段用）：默认等于体力值；【英姿】+1。
   * 只对拥有对应技能 id 的角色生效，避免其他角色被误加强。
   */
  get handLimit() {
    let limit = this.hp;
    if ((this.skills || []).some(s => s.id === 'cls_yingzi')) limit += 1;
    if ((this.skills || []).some(s => s.id === 'cls_weiwu')) limit += 1;
    if ((this.skills || []).some(s => s.id === 'cls_dangyang') && this.hp <= 2) limit += 1;
    return Math.max(0, limit);
  }

  /**
   * 判断是否存活
   */
  get isAlive() {
    return this.status === PLAYER_STATUS.ALIVE;
  }

  get isDying() {
    return this.status === PLAYER_STATUS.DYING;
  }

  get isDead() {
    return this.status === PLAYER_STATUS.DEAD;
  }

  /**
   * 判断是否可以出杀（【咆哮】/ 诸葛连弩 无次数限制）
   */
  get canSha() {
    const unlimited = (this.skills || []).some(s => s.id === 'cls_paoxiao')
      || this.getEquipCards().some(e => e.card.name === '诸葛连弩');
    return unlimited || this.usedSha < 1;
  }

  /**
   * 是否有某技能(按ID)
   */
  hasSkill(skillId) {
    return this.skills.some(s => s.id === skillId);
  }

  /**
   * 是否有某技能标记(简化判断)
   */
  hasSkillTag(tag) {
    return false; // 扩展点: 子类或技能可覆盖
  }

  /**
   * 摸牌
   */
  drawCards(cards) {
    this.handCards.push(...cards);
    cards.forEach(c => { c.owner = this; c.position = 'hand'; });
  }

  /**
   * 弃牌
   */
  discardCard(card) {
    const idx = this.handCards.indexOf(card);
    if (idx !== -1) {
      this.handCards.splice(idx, 1);
      card.position = 'discard';
      card.owner = null;
    }
    return card;
  }

  /**
   * 当前装备的牌列表（仅非空槽，按槽位顺序）
   * @returns {{slot:string, card:Card}[]}
   */
  getEquipCards() {
    const list = [];
    for (let i = 1; i <= this.equipLimit; i++) {
      const slot = `slot${i}`;
      const card = this.equips[slot];
      if (card) list.push({ slot, card });
    }
    // 兼容超出 limit 的历史槽位（正常情况下不存在）
    for (const [slot, card] of Object.entries(this.equips)) {
      if (!card || /^slot\d+$/.test(slot)) continue;
      list.push({ slot, card });
    }
    return list;
  }

  /** 装备数量 */
  getEquipCount() {
    return this.getEquipCards().length;
  }

  /**
   * 按装备子类型查装备（weapon/armor/horse_def/horse_atk）
   * @param {string} subtype
   * @returns {Card|null}
   */
  getEquipByType(subtype) {
    if (!subtype) return null;
    const entry = this.getEquipCards().find(e => e.card.subtype === subtype);
    return entry ? entry.card : null;
  }

  /** 当前武器（无则 null） */
  getWeapon() {
    return this.getEquipByType(EQUIP_SLOTS.WEAPON);
  }

  /** 当前防具（无则 null） */
  getArmor() {
    return this.getEquipByType(EQUIP_SLOTS.ARMOR);
  }

  /**
   * 当前坐骑：kind 省略时优先返回防御马，其次进攻马
   * @param {'def'|'atk'|string} [kind]
   */
  getHorse(kind) {
    if (kind === 'def' || kind === EQUIP_SLOTS.HORSE_DEF) return this.getEquipByType(EQUIP_SLOTS.HORSE_DEF);
    if (kind === 'atk' || kind === EQUIP_SLOTS.HORSE_ATK) return this.getEquipByType(EQUIP_SLOTS.HORSE_ATK);
    return this.getEquipByType(EQUIP_SLOTS.HORSE_DEF) || this.getEquipByType(EQUIP_SLOTS.HORSE_ATK);
  }

  /** 第一个空装备槽（无空槽返回 null） */
  getEmptyEquipSlot() {
    for (let i = 1; i <= this.equipLimit; i++) {
      const slot = `slot${i}`;
      if (!this.equips[slot]) return slot;
    }
    return null;
  }

  /**
   * 装备一张牌。
   * - 指定 slot：放入该槽；若已被占用，返回旧卡（调用方负责进弃牌堆/弃牌事件）。
   * - 不指定 slot：优先替换同 subtype 的槽，否则放入第一个空槽。
   * @param {Card} card 装备牌
   * @param {string} [slot] 目标槽位（slot1..slotN）
   * @returns {Card|null} 被替换下来的旧卡；无则 null
   */
  equip(card, slot) {
    if (!card) return null;
    let targetSlot = slot;
    if (!targetSlot) {
      const same = this.getEquipCards().find(e => e.card.subtype === card.subtype);
      targetSlot = same ? same.slot : this.getEmptyEquipSlot();
    }
    if (!targetSlot || !Object.prototype.hasOwnProperty.call(this.equips, targetSlot)) return null;
    const old = this.equips[targetSlot] || null;
    if (old) {
      old.position = 'discard';
      old.owner = null;
    }
    this.equips[targetSlot] = card;
    card.owner = this;
    card.position = 'equip';
    return old;
  }

  /**
   * 卸下指定槽位的装备
   * @param {string} slot
   * @returns {Card|null} 被卸下的牌
   */
  unequip(slot) {
    const card = this.equips[slot];
    if (card) {
      this.equips[slot] = null;
      card.position = 'discard';
      card.owner = null;
    }
    return card || null;
  }

  /**
   * 放入判定区
   */
  addJudgeCard(card) {
    this.judgeCards.push(card);
    card.owner = this;
    card.position = 'judge';
  }

  /**
   * 受到伤害
   * @returns {boolean} 是否进入濒死
   */
  damage(num = 1) {
    this.hp -= num;
    if (this.hp <= 0) {
      this.status = PLAYER_STATUS.DYING;
      return true;
    }
    return false;
  }

  /**
   * 回复体力
   */
  recover(num = 1) {
    this.hp = Math.min(this.hp + num, this.maxHp);
  }

  /**
   * 求桃(濒死时)
   * @returns {boolean} 是否被救回
   */
  askForPeach() {
    // 简化: 如果手牌有桃则自救
    const tao = this.handCards.find(c => c.name === '桃');
    if (tao) {
      this.discardCard(tao);
      this.recover(1);
      if (this.hp > 0) {
        this.status = PLAYER_STATUS.ALIVE;
        return true;
      }
    }
    return false;
  }

  /**
   * 死亡
   */
  die() {
    this.status = PLAYER_STATUS.DEAD;
    this.handCards.forEach(c => { c.position = 'discard'; c.owner = null; });
    this.handCards = [];
    Object.keys(this.equips).forEach(slot => this.unequip(slot));
    this.judgeCards.forEach(c => { c.position = 'discard'; c.owner = null; });
    this.judgeCards = [];
  }

  /**
   * 回合开始时重置
   */
  resetTurn() {
    this.usedSha = 0;
    this.usedJiu = false;
    this.usedJiuCount = 0;
    this.skillUsedThisTurn.clear();
    // 坐骑等装备的“每回合限一次”标记 + 本回合是否受伤（供【爪黄飞电】等判定）
    this.storage.delete('equipOnce');
    this.storage.delete('damagedThisTurn');
    this.skills.forEach(s => {
      // 限定技/每局一次：不随回合重置
      if (s.type !== 'limited') s.resetUsage();
    });
  }

  /**
   * 获取存档值
   */
  getStorage(key) {
    return this.storage.get(key);
  }

  /**
   * 设置存档值
   */
  setStorage(key, value) {
    this.storage.set(key, value);
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      isAI: this.isAI,
      seatNum: this.seatNum,
      team: this.team,
      character: this.character?.toJSON(),
      hp: this.hp,
      maxHp: this.maxHp,
      hujia: this.hujia,
      handCardCount: this.handCardCount,
      // 装备栏数量 + 通用槽（slot1..slotN）
      equipLimit: this.equipLimit,
      equipSlots: this.equipLimit,
      equips: Object.fromEntries(
        Object.entries(this.equips).map(([k, v]) => [k, v?.toJSON()])
      ),
      // 供 UI 渲染装备框/替换弹窗的数组形式
      equipCards: this.getEquipCards().map(e => ({ slot: e.slot, card: e.card.toJSON() })),
      judgeCards: this.judgeCards.map(c => c.toJSON()),
      skills: this.skills.map(s => s.toJSON()),
      status: this.status,
      isTurnedOver: this.isTurnedOver,
      isLinked: this.isLinked,
      isChained: this.isChained,
      usedJiu: this.usedJiu,
      usedJiuCount: this.usedJiuCount,
      usedSha: this.usedSha,
    };
  }
}
