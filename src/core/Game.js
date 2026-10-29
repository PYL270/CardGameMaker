/**
 * Game - 主游戏控制器
 * 整合所有子系统，驱动游戏循环
 */
import EventEmitter from './EventEmitter';
import Player from './Player';
import Deck from './Deck';
import Distance from './Distance';
import Judgment from './Judgment';
import Turn from './Turn';
import Character from './Character';
import Skill from './Skill';
import { EQUIP_SLOTS } from './Card';
import { createBaseCharacter } from '../data/basicCharacter';
import { CLASSIC_CHARACTERS, CLASSIC_SKILLS } from '../data/classicCharacters';
import { buildStandardDeck } from '../data/basicCards';
import { detectBonds } from '../data/bonds';

export const GAME_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  CHOOSING: 'choosing',     // 选将
  RUNNING: 'running',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

/** 组队/阵营模式：这些单体牌在非 ffa 下只能指定敌对角色（AOE 不受影响） */
export const TEAM_SINGLE_TARGET_CARDS = new Set([
  '杀', '决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断',
]);

export const TEAM_MODES = ['ffa', '2v2', '3v3'];

export default class Game extends EventEmitter {
  constructor() {
    super();
    this.status = GAME_STATUS.IDLE;
    this.players = [];
    this.deck = new Deck();
    this.distance = new Distance();
    this.judgment = new Judgment(this.deck, this);
    this.turn = new Turn(this);

    // 数据注册表(用户自定义内容)
    this.characterRegistry = new Map(); // id -> Character定义
    this.skillRegistry = new Map();     // id -> Skill定义
    this.cardRegistry = new Map();      // id -> Card定义

    // 游戏配置
    this.config = {
      playerCount: 2,
      initHandCards: 4,
      needChooseCharacter: true,
      teamMode: 'ffa', // 'ffa' | '2v2' | '3v3'
      friendlyFire: false, // 组队模式是否允许人类选择队友作为单体目标（严格布尔，默认关）
      autoTrigger: false, // 真人可选触发技是否自动发动（默认弹确认；严格布尔）
    };
    // 组队模式：默认自由混战（自由混战下所有玩家互为敌人）
    this.teamMode = this.config.teamMode || 'ffa';
    // 误伤开关：只认显式 true，非法值一律视为关闭
    this.friendlyFire = this.config.friendlyFire === true;
    // 可选触发技自动发动开关：只认显式 true
    this.autoTrigger = this.config.autoTrigger === true;

    // 日志
    this.logs = [];
    this.onLog = null; // 日志回调

    // UI交互回调(由React组件注入)
    this.ui = {
      askForPlay: null,       // async (player) => action
      askForDiscard: null,    // async (player, count) => cards
      askForTarget: null,     // async (player, candidates) => target
      askForCard: null,       // async (player, filter) => card
      askForSkill: null,      // async (player, skills) => skill
      askForConfirm: null,    // async (message) => boolean
      onStateChange: null,    // (gameState) => void
      onEffect: null,         // (effect) => void  打击感反馈(伤害/出牌)
    };

    // 扩展区(用户可注入的自定义逻辑)
    this.extensions = new Map();

    // 胜利/失败判定
    this.winCondition = null; // (game) => 'win'|'lose'|null
    this.loseCondition = null; // (game) => 'win'|'lose'|null

    // 投降：记录座位号，供 UI 区分“主动投降”与正常胜负
    this.surrenderSeat = null;
    // 武将羁绊：本局激活列表 + 每个羁绊的组合技使用记录（每局一次）
    this.bonds = [];
    this.bondUsage = new Map();
  }

  /**
   * 注册武将
   */
  registerCharacter(character) {
    const c = character instanceof Character ? character : new Character(character || {});
    this.characterRegistry.set(c.id, c);
    return c;
  }

  /**
   * 注册技能
   */
  registerSkill(skill) {
    const s = skill instanceof Skill ? skill : new Skill(skill || {});
    this.skillRegistry.set(s.id, s);
    return s;
  }

  /**
   * 注册自定义牌
   */
  registerCardType(cardDef) {
    this.cardRegistry.set(cardDef.name, cardDef);
  }

  /**
   * 注册扩展
   */
  registerExtension(name, ext) {
    this.extensions.set(name, ext);
    if (ext.onRegister) ext.onRegister(this);
  }

  /**
   * 触发所有玩家的时机技能
   * @param {string} timing - 触发时机(如 damaged / phaseDrawBegin2)
   * @param {object} data - 事件数据(可在技能中修改，如 data.num)
   * @returns {object} 事件对象
   */
  async fireTiming(timing, data = {}) {
    const event = {
      name: timing,
      data,
      game: this,
      player: data.player || null,
      canceled: false,
      result: {},
      // 用箭头函数绑定外层事件：技能拿到的是包装后的 costEvent，调用 cancel() 也必须作用于本次结算
      cancel: () => {
        event.canceled = true;
        if (event.data && typeof event.data === 'object') event.data.canceled = true;
      },
    };
    // 事件相关玩家: player(回合/阶段所属) 或 target(受伤/成为目标者)
    const involvedPlayer = data.player || data.target || null;
    const candidates = new Set(this.getAlivePlayers());
    if (involvedPlayer) candidates.add(involvedPlayer); // 允许死亡时的 die/dieAfter 触发
    for (const player of candidates) {
      if (event.canceled) break;
      const skills = player.skills || [];
      for (const skill of skills) {
        if (!skill || skill.isDisabled) continue;
        if (skill.triggerTiming !== timing) continue;
        // 技能分类严格化：只有 trigger / locked 可被时机自动触发；
        // type==='active' 即使数据里误配了 triggerTiming 也一律忽略（不自动触发、不进主动列表）
        if (skill.type !== 'trigger' && skill.type !== 'locked') {
          if (skill.type === 'active' && skill.triggerTiming) {
            this.warnSkillDataOnce(skill,
              `技能【${skill.name}】数据异常：主动技配置了触发时机 ${skill.triggerTiming}，已忽略自动触发（请把类型改为触发技或移除触发时机）`);
          }
          continue;
        }
        // 非全局技能只对事件相关玩家生效
        if (skill.triggerSource !== 'global' && involvedPlayer && involvedPlayer !== player) continue;
        if (skill.usable > 0 && skill.usedCount >= skill.usable) continue;
        let ok = false;
        try { ok = skill.filter(event, player); } catch (e) {
          // 过滤条件异常不再静默吞掉，记录日志后继续结算其他技能
          this.addLog(`技能【${skill.name}】触发判定出错: ${e.message}`);
          continue;
        }
        if (!ok) continue;
        if (!skill.forced) {
          if (player.isAI) {
            let check = true;
            try { check = skill.ai?.check ? skill.ai.check(event, player) : true; } catch (e) {
              check = false;
              this.addLog(`技能【${skill.name}】AI 判断出错: ${e.message}`);
            }
            if (!check) continue;
          } else if (this.autoTrigger) {
            // 可选触发技自动发动：真人也不再弹确认，按 ai.check（无则默认发动）决定
            let check = true;
            try { check = skill.ai?.check ? skill.ai.check(event, player) : true; } catch (e) {
              check = false;
              this.addLog(`技能【${skill.name}】自动发动判断出错: ${e.message}`);
            }
            if (!check) continue;
            this.addLog(`技能【${skill.name}】【自动发动】`);
          } else {
            const confirmed = await this.askForConfirm(`是否发动技能【${skill.name}】？`, player);
            if (!confirmed) continue;
          }
        }
        try {
          const costResult = { bool: true };
          const costEvent = { ...event, result: costResult };
          await skill.cost(costEvent, costEvent, player);
          if (costResult.bool === false) continue;
          skill.usedCount++;
          await skill.content(costEvent, costEvent, player);
          this.notifyStateChange();
          // 技能通过 event.cancel() 取消事件时中断后续技能
          if (event.canceled) break;
        } catch (e) {
          // 技能执行异常不影响本次伤害/结算流程，但必须留下日志
          this.addLog(`技能【${skill.name}】执行出错: ${e.message}`);
        }
      }
    }
    return event;
  }

  /**
   * 计算某张牌的有效目标（含【空城】等目标限制）
   * @param {Player} player 使用者
   * @param {string} cardName 牌名
   * @param {object} opts - 可选：{ ignoreDistance:true } 让【杀】无视距离（如【武圣】强化）
   * @returns {Player[]}
   */
  getValidTargets(player, cardName, opts = {}) {
    if (!player) return [];
    // 组队模式：默认单体伤害/控制牌只能指定敌对角色；
    // 开启 friendlyFire（误伤）后不再排除队友，允许人类选择队友为目标；ffa 不受影响。
    const teamAllowed = (t) => !TEAM_SINGLE_TARGET_CARDS.has(cardName)
      || this.friendlyFire
      || this.isEnemy(player, t);
    const others = this.distance.getOtherAlivePlayers(player)
      .filter(t => this.isTargetAllowed(player, t, cardName))
      .filter(teamAllowed);
    // 奇才：黄月英使用顺手牵羊/兵粮寸断无距离限制
    const ignoreTrickDistance = (player.skills || []).some(s => s.id === 'cls_qicai');
    switch (cardName) {
      case '杀': {
        // 关羽【武圣】：使用【杀】无距离限制（仅影响目标计算，武器范围/距离显示逻辑不变）
        const ignoreDistance = opts.ignoreDistance === true
          || (player.skills || []).some(s => s.id === 'cls_wusheng');
        const base = ignoreDistance
          ? this.distance.getOtherAlivePlayers(player)
          : this.distance.getShaTargets(player);
        return base
          .filter(t => this.isTargetAllowed(player, t, cardName))
          .filter(teamAllowed);
      }
      case '顺手牵羊':
        return others.filter(t => (ignoreTrickDistance || this.distance.getAttackDistance(player, t) <= 1)
          && this.hasAnyCard(t));
      case '兵粮寸断':
        return others.filter(t => (ignoreTrickDistance || this.distance.getAttackDistance(player, t) <= 1)
          && !(t.judgeCards || []).some(c => c.name === '兵粮寸断'));
      case '过河拆桥':
        return others.filter(t => this.hasAnyCard(t));
      case '乐不思蜀':
        return others.filter(t => !(t.judgeCards || []).some(c => c.name === '乐不思蜀'));
      case '决斗':
        return others;
      default:
        return others;
    }
  }

  /**
   * AI 决策用的单体目标候选：在 getValidTargets 基础上再显式排除队友。
   * 供 aiAutoPlay / 自动选目标使用；AOE(南蛮/万箭)不经过这里，仍命中所有人。
   */
  getAITargets(player, cardName) {
    return this.getValidTargets(player, cardName).filter(t => this.isEnemy(player, t));
  }

  /** 目标是否有任何可被顺/拆的牌（手牌、装备、判定区） */
  hasAnyCard(target) {
    if (!target) return false;
    if (target.handCards?.length > 0) return true;
    if (target.getEquipCards?.().length > 0) return true;
    if (target.judgeCards?.length > 0) return true;
    return false;
  }

  /** 从目标处取走一张牌（手牌 → 装备 → 判定区） */
  takeAnyCard(target) {
    if (!target) return null;
    if (target.handCards?.length > 0) return target.handCards.pop();
    const equipEntry = target.getEquipCards?.()[0];
    if (equipEntry) return target.unequip(equipEntry.slot);
    if (target.judgeCards?.length > 0) return target.judgeCards.pop();
    return null;
  }

  /** 是否装备了某张牌（按名称） */
  hasEquip(player, name) {
    if (!player || typeof player.getEquipCards !== 'function') return false;
    return player.getEquipCards().some(e => e.card?.name === name);
  }

  /** 获取装备槽中的某张牌 */
  getEquip(player, name) {
    if (!player || typeof player.getEquipCards !== 'function') return null;
    const entry = player.getEquipCards().find(e => e.card?.name === name);
    return entry ? entry.card : null;
  }

  /**
   * 解析 UI 返回的装备替换选择：槽 key（slot2）/ card id / {slot} / {cardId} / {card:{id}}
   * 只接受属于 current 的选择，非法返回 null（由调用方 fallback）。
   * @param {*} choice
   * @param {{slot:string,card:object}[]} current
   * @returns {{slot:string,card:object}|null}
   */
  resolveEquipChoice(choice, current) {
    if (!choice || !Array.isArray(current) || current.length === 0) return null;
    const bySlot = (slot) => current.find(e => e.slot === slot) || null;
    if (typeof choice === 'string') {
      return bySlot(choice) || current.find(e => e.card?.id === choice) || null;
    }
    if (typeof choice === 'object') {
      if (typeof choice.slot === 'string') {
        const hit = bySlot(choice.slot);
        if (hit) return hit;
      }
      const ids = [choice.cardId, choice.card?.id, choice.id].filter(Boolean);
      for (const id of ids) {
        const hit = current.find(e => e.card?.id === id);
        if (hit) return hit;
      }
    }
    return null;
  }

  /**
   * 装备类“每回合限一次”标记：同一 key 在玩家自己的回合内只允许成功一次。
   * 标记存于 player.storage('equipOnce')，在 Player.resetTurn()（该玩家回合开始）时清空。
   * @returns {boolean} 本次是否成功占用（true=可触发）
   */
  tryEquipOnce(player, key) {
    if (!player) return false;
    let used = player.getStorage('equipOnce');
    if (!used || typeof used.has !== 'function') {
      used = new Set();
      player.setStorage('equipOnce', used);
    }
    if (used.has(key)) return false;
    used.add(key);
    return true;
  }

  /**
   * 出牌阶段能否主动使用这张牌（不含目标选择的 UI 规则）
   * 闪/无懈只能响应，不能在出牌阶段主动打出。
   */
  canPlayCard(player, card) {
    if (!player?.isAlive || !card) return false;
    switch (card.name) {
      case '闪':
      case '无懈可击':
        return false;
      case '桃':
        return player.hp < player.maxHp;
      case '酒':
        return (player.usedJiuCount || 0) < 1;
      case '杀':
        return player.canSha && this.getValidTargets(player, '杀').length > 0;
      case '决斗':
        return this.getValidTargets(player, '决斗').length > 0;
      case '顺手牵羊':
        return this.getValidTargets(player, '顺手牵羊').length > 0;
      case '过河拆桥':
        return this.getValidTargets(player, '过河拆桥').length > 0;
      case '乐不思蜀':
        return this.getValidTargets(player, '乐不思蜀').length > 0;
      case '兵粮寸断':
        return this.getValidTargets(player, '兵粮寸断').length > 0;
      default:
        // 无中生有/南蛮/万箭/桃园/闪电/装备：出牌阶段可直接使用
        return true;
    }
  }

  /** 出牌阶段该牌的可选目标（统一给 UI / 联机 prompt 使用） */
  getPlayableTargets(player, cardName) {
    return this.getValidTargets(player, cardName);
  }

  /** 装备提供的主动出牌选项（如丈八蛇矛） */
  getWeaponActions(player) {
    const actions = [];
    if (this.hasEquip(player, '丈八蛇矛')
      && player.handCards.length >= 2
      && player.canSha) {
      actions.push({
        id: 'zhangba',
        name: '丈八蛇矛',
        description: '将两张手牌当【杀】使用',
      });
    }
    return actions;
  }

  /**
   * 发动装备主动效果
   * 目前支持丈八蛇矛：两张手牌当【杀】
   */
  async useWeaponAction(player, weaponId) {
    if (weaponId !== 'zhangba') return false;
    if (!this.hasEquip(player, '丈八蛇矛')
      || player.handCards.length < 2
      || !player.canSha) return false;
    // 审计修复：原代码误调用不存在的 this.askForCards，导致丈八蛇矛发动时抛 TypeError；
    // 统一走 chooseCards（内部优先 ui.askForCards，无 UI 时自动选前两张）。
    const cards = await this.chooseCards(player, {
      min: 2,
      max: 2,
      hint: '丈八蛇矛：选择两张手牌当【杀】',
    });
    if (!cards || cards.length < 2) return false;
    const targets = this.getValidTargets(player, '杀');
    const target = await this.askForTarget(player, targets, '选择【杀】的目标');
    if (!target) return false;
    for (const c of cards) {
      player.discardCard(c);
      this.deck.discardOne(c);
    }
    this.emitDiscard(player, cards, 'cost');
    const virtualSha = {
      name: '杀',
      type: 'basic',
      suit: 'spade',
      number: 0,
      numberDisplay: '',
    };
    this.emitUiEffect({ type: 'card', player, card: virtualSha });
    this.addLog(`${player.name} 使用丈八蛇矛，将两张手牌当【杀】`);
    await this.resolveShaUse(player, virtualSha, target);
    return true;
  }

  /** 目标是否允许被该牌指定（空城：无手牌不能成为【杀】【决斗】目标） */
  isTargetAllowed(source, target, cardName) {
    if (!target || !target.isAlive) return false;
    if (cardName === '杀' || cardName === '决斗') {
      const hasKongcheng = (target.skills || []).some(s => s.id === 'cls_kongcheng');
      if (hasKongcheng && target.handCards.length === 0) return false;
    }
    return true;
  }

  /**
   * 判断技能是否为“真正的主动技”（可在出牌阶段主动发动）
   * 规则：enable==='phaseUse'，或 type==='active' 且没有配置触发时机。
   * trigger/locked 一律不是主动技；type==='active' 但误配 triggerTiming 的数据视为异常。
   */
  isActiveSkill(skill) {
    if (!skill) return false;
    if (skill.type === 'trigger' || skill.type === 'locked') return false;
    if (skill.enable === 'phaseUse') return true;
    return skill.type === 'active' && !skill.triggerTiming;
  }

  /** 数据异常只提示一次（避免 UI 反复过滤时刷日志） */
  warnSkillDataOnce(skill, message) {
    if (!skill) return;
    if (!this._skillDataWarned) this._skillDataWarned = new Set();
    const key = skill.id || skill.name;
    if (this._skillDataWarned.has(key)) return;
    this._skillDataWarned.add(key);
    this.addLog(message);
  }

  /** 玩家当前可用的主动技能（出牌阶段） */
  getActiveSkills(player) {
    return (player?.skills || []).filter(skill => {
      if (!skill || skill.isDisabled) return false;
      // 严格分类：trigger/locked 永不出现在主动列表
      if (skill.type === 'trigger' || skill.type === 'locked') return false;
      if (!this.isActiveSkill(skill)) {
        if (skill.type === 'active' && skill.triggerTiming) {
          this.warnSkillDataOnce(skill,
            `技能【${skill.name}】数据异常：主动技带触发时机 ${skill.triggerTiming}，已从主动列表移除且不会自动触发`);
        }
        return false;
      }
      if (skill.usable > 0 && skill.usedCount >= skill.usable) return false;
      try {
        return !!skill.filter({ name: 'phaseUse', data: { player }, game: this, player }, player);
      } catch {
        return false;
      }
    });
  }

  /**
   * 发动主动技能
   * @returns {Promise<boolean>}
   */
  async useActiveSkill(player, skill) {
    if (!skill) return false;
    // 严格分类：触发/锁定技不能走主动发动入口
    if (!this.isActiveSkill(skill)) return false;
    if (skill.usable > 0 && skill.usedCount >= skill.usable) return false;
    const event = {
      name: 'useSkill',
      skill,
      player,
      game: this,
      data: { player, skill },
      result: {},
      canceled: false,
      cancel() { this.canceled = true; },
    };
    try {
      await skill.cost(event, event, player);
      if (event.result && event.result.bool === false) return false;
      skill.usedCount++;
      await skill.content(event, event, player);
      this.notifyStateChange();
      return true;
    } catch (e) {
      this.addLog(`技能【${skill.name}】执行出错: ${e.message}`);
      return false;
    }
  }

  /**
   * AI 眼中的“可弃/可送”牌：保留桃、闪、无懈与装备，其余视为低价值牌。
   * 用于制衡、仁德、武圣等主动技的 AI 选择，避免 AI 把保命牌或装备烧掉。
   */
  isAiDisposableCard(card) {
    if (!card) return false;
    if (['桃', '闪', '无懈可击'].includes(card.name)) return false;
    if (card.type === 'equip') return false;
    return true;
  }

  /** 低价值牌排序：越靠前越适合弃置/送出 */
  aiDisposableScore(card) {
    const order = {
      '闪电': 0,
      '乐不思蜀': 1,
      '兵粮寸断': 1,
      '酒': 2,
      '杀': 3,
      '决斗': 3,
      '南蛮入侵': 4,
      '万箭齐发': 4,
      '顺手牵羊': 5,
      '过河拆桥': 5,
      '桃园结义': 6,
    };
    const base = order[card?.name] ?? 5;
    return base + (card?.ai?.order || 0);
  }

  /**
   * AI 主动技选牌（无 UI / 联机 AI 分支共用）。
   * - 制衡：弃 1~2 张低价值牌换牌
   * - 仁德：送 1~2 张低价值牌给队友
   * - 武圣：选一张红色低价值牌当【杀】
   */
  aiPickSkillCards(player, { min = 1, max = 1, filter = null, hint = '' } = {}) {
    const pool = (player?.handCards || []).filter(filter || (() => true));
    if (pool.length === 0) return [];
    const text = String(hint || '');
    const sorted = [...pool].sort((a, b) => this.aiDisposableScore(a) - this.aiDisposableScore(b));
    const disposable = sorted.filter(c => this.isAiDisposableCard(c));

    if (text.includes('制衡') || text.includes('仁德')) {
      const picked = disposable.slice(0, Math.min(2, Math.max(1, max)));
      if (picked.length > 0) return picked;
      return sorted.slice(0, Math.min(1, Math.max(1, min)));
    }
    if (text.includes('武圣')) {
      const reds = disposable.filter(c => c.isRed);
      if (reds.length > 0) return reds.slice(0, 1);
      // 断杀且只有红桃/闪时，武圣仍可把红牌当杀（保命牌优先，仅作兜底）
      return sorted.filter(c => c.isRed).slice(0, 1);
    }
    if (text.includes('火计')) {
      return disposable.filter(c => c.isRed).slice(0, 1);
    }
    if (text.includes('纳贤') || text.includes('离间')) {
      const picked = disposable.slice(0, 1);
      if (picked.length > 0) return picked;
    }
    return sorted.slice(0, Math.max(1, min));
  }

  /** AI 主动技选目标：仁德优先受伤的队友，其余优先敌人 */
  aiPickSkillTarget(player, candidates, hint = '') {
    const list = (candidates || []).filter(Boolean);
    if (list.length === 0) return null;
    if (String(hint || '').includes('仁德') || String(hint || '').includes('纳贤')) {
      const allies = list.filter(t => t !== player && !this.isEnemy(player, t));
      const pool = allies.length > 0 ? allies : list.filter(t => t !== player);
      if (String(hint || '').includes('纳贤') && allies.length === 0) return null;
      const ranked = (pool.length > 0 ? pool : list).slice().sort((a, b) =>
        (a.hp - b.hp) || (a.handCards.length - b.handCards.length));
      return ranked[0] || null;
    }
    const enemies = list.filter(t => this.isEnemy(player, t));
    return enemies[0] || list[0];
  }

  /**
   * AI 主动技决策：只使用收益明确的技能，避免为了发动而发动。
   * @returns {{type:'useSkill', skillId:string}|null}
   */
  aiChooseActiveSkill(player) {
    const skills = this.getActiveSkills(player);
    if (skills.length === 0) return null;
    const findSkill = (id) => skills.find(s => s.id === id);
    const disposable = player.handCards.filter(c => this.isAiDisposableCard(c));

    // 仁德：组队模式有队友，且自己或队友受伤时，送牌并回血
    const rende = findSkill('cls_rende');
    if (rende) {
      const allies = this.getAlivePlayers().filter(p => p !== player && !this.isEnemy(player, p));
      const wounded = player.hp < player.maxHp || allies.some(p => p.hp < p.maxHp);
      if (allies.length > 0 && wounded && disposable.length > 0) {
        return { type: 'useSkill', skillId: rende.id };
      }
    }

    // 制衡：至少两张低价值牌时弃2摸3（弃≥2额外摸1）
    const zhiheng = findSkill('cls_zhiheng');
    if (zhiheng && disposable.length >= 2) {
      return { type: 'useSkill', skillId: zhiheng.id };
    }

    // 武圣：手里没有【杀】时，把红色低价值牌当【杀】用，避免烧掉桃/闪/装备
    const wusheng = findSkill('cls_wusheng');
    if (wusheng && player.canSha
      && !player.handCards.some(c => c.name === '杀')
      && disposable.some(c => c.isRed)
      && this.getAITargets(player, '杀').length > 0) {
      return { type: 'useSkill', skillId: wusheng.id };
    }

    // 火计：有红色可弃牌且攻击范围内有敌人时，弃牌换1点火焰伤害
    const huoji = findSkill('cls_huoji');
    if (huoji && disposable.some(c => c.isRed)
      && this.getAITargets(player, '杀').length > 0) {
      return { type: 'useSkill', skillId: huoji.id };
    }

    // 纳贤：有可弃牌且有队友时，给队友补牌（团队收益）
    const naxian = findSkill('cls_naxian');
    if (naxian && disposable.length > 0) {
      const allies = this.getAlivePlayers().filter(p => p !== player && !this.isEnemy(player, p));
      if (allies.length > 0) return { type: 'useSkill', skillId: naxian.id };
    }

    // 离间：有可弃牌且有男性敌人时，逼其弃【杀】或掉血
    const lijian = findSkill('cls_lijian');
    if (lijian && disposable.length > 0) {
      const males = this.getAlivePlayers().filter(p =>
        p !== player && this.isEnemy(player, p) && p.character?.sex === 'male');
      if (males.length > 0) return { type: 'useSkill', skillId: lijian.id };
    }
    return null;
  }

  /**
   * 请求玩家选择手牌（主动技能用）
   * 无 UI 时(测试/AI)按 AI 策略自动选择
   */
  async chooseCards(player, { min = 1, max = 1, filter = null, hint = '' } = {}) {
    if (typeof this.ui.askForCards === 'function') {
      return await this.ui.askForCards(player, { min, max, filter, hint });
    }
    return this.aiPickSkillCards(player, { min, max, filter, hint });
  }

  /** 请求玩家选择目标（主动技能用） */
  async chooseTarget(player, candidates, hint = '') {
    if (!candidates || candidates.length === 0) return null;
    if (typeof this.ui.askForTarget === 'function') {
      return await this.ui.askForTarget(player, candidates, hint);
    }
    return this.aiPickSkillTarget(player, candidates, hint);
  }

  /** 从弃牌堆取回一张牌（用于【奸雄】等） */
  takeCardFromDiscard(card) {
    const idx = this.deck.discardPile.indexOf(card);
    if (idx !== -1) this.deck.discardPile.splice(idx, 1);
    return card;
  }

  /**
   * 通知 UI 播放反馈效果(音效/震动/动画)
   */
  emitUiEffect(effect) {
    if (typeof this.ui.onEffect === 'function') {
      try {
        this.ui.onEffect(effect);
      } catch {
        // UI 反馈失败不影响对局
      }
    }
  }

  /**
   * 演出事件用的“序列化安全”玩家信息（death/dying/judge/heal/discard 使用）
   * @returns {{id,name,seatNum,character,team,characterImage,hp,maxHp,sex,group}|null}
   */
  effectPlayer(player) {
    if (!player) return null;
    const character = player.character || null;
    return {
      id: player.id,
      name: player.name,
      seatNum: player.seatNum,
      character: character?.name || null,
      team: player.team ?? null,
      // 卡面信息（供 UI 渲染武将牌/分半动画；imageUrl 可能为 dataURL/http(s)，原样透传、不写日志）
      characterImage: character?.imageUrl || '',
      hp: player.hp,
      maxHp: player.maxHp,
      sex: character?.sex || null,
      group: character?.group || null,
    };
  }

  /**
   * 弃牌演出事件（同一批弃牌合并为一个事件）
   * @param {Player} player 弃牌的角色（过河/寒冰/顺手等为被弃牌的角色）
   * @param {Card|Card[]} cards 一张或多张牌
   * @param {'phase'|'cost'|'effect'|'replace'|'other'} reason 弃牌原因
   * @returns {boolean} 是否发出事件（无牌不发）
   */
  emitDiscard(player, cards, reason = 'other') {
    const list = (Array.isArray(cards) ? cards : [cards]).filter(Boolean);
    if (!player || list.length === 0) return false;
    this.emitUiEffect({
      type: 'discard',
      player: this.effectPlayer(player),
      cards: list.map(card => ({
        name: card.name,
        suit: card.suit,
        numberDisplay: card.numberDisplay,
        type: card.type,
      })),
      reason,
    });
    return true;
  }

  /** 回复演出事件：桃/桃园结义/濒死自救/技能回复等统一走这里 */
  emitHeal(player, num = 1, source = null) {
    this.emitUiEffect({
      type: 'heal',
      player: this.effectPlayer(player),
      num,
      source: this.effectPlayer(source),
    });
  }

  /**
   * 判定揭示演出事件
   * @param {Player} player 判定者
   * @param {Card|null} card 判定牌
   * @param {Card|null} delayCard 延时锦囊（八卦阵等无延时牌时为 null）
   * @param {boolean} success 判定是否生效
   */
  emitJudgeEffect(player, card, delayCard, success) {
    this.emitUiEffect({
      type: 'judge',
      player: this.effectPlayer(player),
      card: card ? {
        name: card.name,
        suit: card.suit,
        numberDisplay: card.numberDisplay,
        isRed: card.isRed,
      } : null,
      delayCard: delayCard ? { name: delayCard.name } : null,
      success: !!success,
    });
  }

  /**
   * 执行一次判定并发出 judge 演出事件（八卦阵等非判定区判定统一走这里）
   * @param {Player} player
   * @param {string} judgeType - 判定类型（Judgment.getResult 支持的类型）
   * @param {Card|null} delayCard - 关联延时锦囊（可选）
   * @returns {Promise<{card: Card|null, success: boolean}>}
   */
  async performJudge(player, judgeType, delayCard = null) {
    const card = this.judgment.judge();
    const success = this.judgment.getResult(card, judgeType);
    if (card) this.deck.discardOne(card);
    this.emitJudgeEffect(player, card, delayCard, success);
    return { card, success };
  }

  /**
   * 统一的伤害流程(触发伤害技能 -> 扣血 -> 濒死)
   * @param {object} opts
   * @param {Player} opts.target - 受伤者
   * @param {Player|null} opts.source - 伤害来源
   * @param {number} opts.num - 伤害点数
   * @param {Card|null} opts.card - 造成伤害的牌
   * @param {string} opts.nature - 伤害属性(normal/fire/thunder)
   * @param {string|null} opts.reason - 死亡原因(damage/lightning/duel/other)，用于 death 演出事件
   * @returns {number} 实际造成的伤害
   */
  async dealDamage({ target, source = null, num = 1, card = null, nature = 'normal', reason = null }) {
    if (!target || !target.isAlive) return 0;
    const dmgEvent = { target, source, num, card, nature, canceled: false, cancel() { this.canceled = true; } };
    await this.emit('damageBegin', dmgEvent);
    await this.fireTiming('damageBegin', dmgEvent);
    if (dmgEvent.canceled) {
      this.addLog(`${target.name} 的伤害被防止`);
      this.emitUiEffect({ type: 'damage-canceled', target });
      return 0;
    }
    const finalNum = Math.max(0, dmgEvent.num);
    if (finalNum > 0) {
      target.damage(finalNum);
      // 记录“本回合受到过伤害”，供【爪黄飞电】等结束阶段效果判定（Player.resetTurn 清除）
      target.setStorage('damagedThisTurn', true);
      this.emitUiEffect({ type: 'damage', source, target, num: finalNum, card, nature });
    }
    await this.fireTiming('damaged', { target, source, num: finalNum, card, nature });
    // 濒死/死亡流程需要携带伤害来源与死因（供 dying/death 演出事件）
    if (target.isDying) await this.handleDying(target, { source, reason: reason || 'damage' });
    return finalNum;
  }

  /**
   * 应用本局武将羁绊：写入 bondIds / 被动数值，并广播 bondAwaken。
   * 无羁绊时完全静默（不改变原有对局的事件流）。
   */
  applyBonds() {
    this.bonds = detectBonds(this.players);
    this.bondUsage = new Map();
    if (!this.bonds.length) return [];

    for (const bond of this.bonds) {
      this.bondUsage.set(bond.id, false);
      const members = this.players.filter(player =>
        bond.memberIds.includes(player.character?.id));
      for (const player of members) {
        const owned = player.getStorage('bondIds');
        const ids = Array.isArray(owned) ? owned : [];
        player.setStorage('bondIds', [...new Set([...ids, bond.id])]);
        if (bond.id === 'taoyuan') {
          player.maxHp = Math.max(0, Number(player.maxHp) || 0) + 1;
          player.hp = Math.min(player.maxHp, (Number(player.hp) || 0) + 1);
          player.setStorage('bondMaxHp', 1);
        } else if (bond.id === 'weimou') {
          player.setStorage('bondHandLimit', Number(player.getStorage('bondHandLimit')) + 1 || 1);
        } else if (bond.id === 'jiangdong') {
          player.setStorage('bondAttackRange', Number(player.getStorage('bondAttackRange')) + 1 || 1);
        } else if (bond.id === 'wolong') {
          player.setStorage('bondTrickDraw', true);
        }
      }
      const names = members.map(player => player.name).join('、');
      this.addLog(`羁绊觉醒【${bond.name}】：${names}（${bond.passive}）`);
    }

    this.emitUiEffect({
      type: 'bondAwaken',
      bonds: this.bonds.map(bond => ({
        id: bond.id,
        name: bond.name,
        members: bond.members,
        desc: bond.desc,
        passive: bond.passive,
      })),
      bondName: this.bonds[0]?.name || '',
      members: this.bonds[0]?.members || [],
    });
    return this.bonds;
  }

  /**
   * 组合技：成员使用【杀】命中敌人时，若至少一名羁绊队友存活，
   * 消耗该羁绊本局唯一一次合击，额外 +1 伤害。
   * @returns {number} 额外伤害（0 或 1）
   */
  tryBondCombo(player, target) {
    if (!player || !target || !player.isAlive || !target.isAlive) return 0;
    if (typeof this.isEnemy === 'function' && !this.isEnemy(player, target)) return 0;
    const ids = player.getStorage('bondIds');
    if (!Array.isArray(ids) || !ids.length) return 0;

    for (const id of ids) {
      if (this.bondUsage.get(id)) continue;
      const bond = this.bonds.find(item => item.id === id);
      if (!bond) continue;
      const partnerAlive = this.players.some(other =>
        other !== player
        && other.isAlive
        && bond.memberIds.includes(other.character?.id));
      if (!partnerAlive) continue;

      this.bondUsage.set(id, true);
      const members = this.players
        .filter(other => other.isAlive && bond.memberIds.includes(other.character?.id))
        .map(other => this.effectPlayer(other));
      this.emitUiEffect({
        type: 'bondCombo',
        bondId: bond.id,
        bondName: bond.name,
        comboName: bond.comboName,
        members,
        source: this.effectPlayer(player),
        target: this.effectPlayer(target),
        num: 1,
      });
      this.addLog(`【${bond.name}·${bond.comboName}】${members.map(m => m.name).join('、')} 合击 ${target.name}，伤害 +1`);
      return 1;
    }
    return 0;
  }

  /**
   * 卧龙凤雏：每回合首次使用锦囊摸 1 张。
   * @returns {boolean} 是否触发摸牌
   */
  tryBondTrickDraw(player, card) {
    if (!player || !card) return false;
    if (card.type !== 'trick' && card.type !== 'delay_trick') return false;
    if (player.getStorage('bondTrickDraw') !== true) return false;
    if (player.getStorage('bondTrickUsed') === true) return false;
    player.setStorage('bondTrickUsed', true);
    player.drawCards(this.deck.draw(1));
    this.emitUiEffect({
      type: 'bondPassive',
      bondId: 'wolong',
      bondName: '卧龙凤雏',
      name: '卧龙凤雏',
      player: this.effectPlayer(player),
      num: 1,
    });
    this.addLog(`【卧龙凤雏】${player.name} 本回合首次使用锦囊，摸 1 张牌`);
    return true;
  }

  /** 公开羁绊状态（UI / 联机快照） */
  getBondState() {
    return (this.bonds || []).map(bond => ({
      id: bond.id,
      name: bond.name,
      desc: bond.desc,
      passive: bond.passive,
      members: bond.members,
      used: this.bondUsage.get(bond.id) === true,
    }));
  }

  /**
   * 注册内置经典武将（只注册一次，避免重复 init 时覆盖用户内容）
   */
  initClassicContent() {
    if (this._classicReady) return;
    this._classicReady = true;
    for (const def of CLASSIC_SKILLS) {
      if (!this.skillRegistry.has(def.id)) this.skillRegistry.set(def.id, new Skill(def));
    }
    for (const def of CLASSIC_CHARACTERS) {
      if (!this.characterRegistry.has(def.id)) this.characterRegistry.set(def.id, new Character(def));
    }
  }

  /**
   * 初始化游戏
   */
  async init(playerConfigs = []) {
    this.initClassicContent();
    this.surrenderSeat = null;
    this.bonds = [];
    this.bondUsage = new Map();
    this.status = GAME_STATUS.PREPARING;
    // 组队/阵营：每次 init 都从 config 读取（重开时由调用方把 teamMode/friendlyFire 写回 config）
    this.teamMode = this.config.teamMode || 'ffa';
    // 误伤开关：严格布尔，只有显式 true 才开启，非法值（字符串/数字等）按 false
    this.friendlyFire = this.config.friendlyFire === true;
    // 可选触发技自动发动：同样严格布尔（每次 init 重读）
    this.autoTrigger = this.config.autoTrigger === true;

    // 创建玩家
    this.players = playerConfigs.map((cfg, i) => {
      const player = new Player({
        name: cfg.name || `玩家${i + 1}`,
        isAI: cfg.isAI ?? (i > 0),
        seatNum: i,
        // 非 ffa：优先使用显式 team(0/1)，否则按座次交替分队；ffa 一律 null
        team: this.teamMode === 'ffa' ? null : (cfg.team ?? (i % 2)),
      });
      let char = cfg.characterId ? this.characterRegistry.get(cfg.characterId) : null;
      // 兜底：未选武将时使用带技能的"基础角色"
      if (!char) {
        const base = createBaseCharacter();
        player.setCharacter(base.character);
        player.skills.push(...base.skills);
        return player;
      }
      player.setCharacter(char);
      // 挂载技能(每个玩家持有独立实例，避免使用次数串号)
      for (const skillId of char.skillIds) {
        const proto = this.skillRegistry.get(skillId);
        if (proto) {
          const inst = Object.create(Object.getPrototypeOf(proto));
          Object.assign(inst, proto);
          inst.usedCount = 0;
          inst.isDisabled = false;
          player.skills.push(inst);
        }
      }
      return player;
    });

    // 初始化牌堆
    const cardDefs = buildStandardDeck();
    // 加上用户自定义牌
    for (const [, cardDef] of this.cardRegistry) {
      if (cardDef.pile) cardDefs.push(...cardDef.pile);
    }
    this.deck.init(cardDefs, this.config.seed ?? null);

    // 更新距离
    this.distance.updatePlayers(this.players);

    // 武将羁绊：在发牌前应用被动，保证起手体力/手牌上限/攻击范围正确
    this.applyBonds();

    // 发初始手牌
    for (const player of this.players) {
      const cards = this.deck.draw(this.config.initHandCards);
      player.drawCards(cards);
    }

    this.status = GAME_STATUS.RUNNING;
    this.addLog('游戏开始！');
    // 组队模式开局日志：我方 / 敌方 名单（UI 与联机可直接展示）
    if (this.teamMode !== 'ffa') {
      const myTeam = this.players[0]?.team ?? null;
      if (myTeam !== null && myTeam !== undefined) {
        const mine = this.getTeamPlayers(myTeam).map(p => p.name).join('、');
        const enemies = this.players.filter(p => p.team !== myTeam).map(p => p.name).join('、');
        this.addLog(`组队模式 ${this.teamMode}：我方 ${mine || '无'} / 敌方 ${enemies || '无'}`);
      }
    }
    this.notifyStateChange();
  }

  /**
   * 运行游戏主循环
   */
  async run(startPlayerIndex = 0) {
    let currentPlayerIdx = startPlayerIndex;

    while (this.status === GAME_STATUS.RUNNING) {
      // 检查胜负
      const result = this.checkWinLose();
      if (result) {
        this.status = GAME_STATUS.FINISHED;
        if (result === 'win') {
          this.addLog(this.teamMode !== 'ffa' ? '你的队伍获胜！' : '你赢了！');
        } else {
          this.addLog('你输了！');
        }
        this.notifyStateChange();
        break;
      }

      const player = this.getNextAlivePlayerByIndex(currentPlayerIdx);
      if (!player) break;

      await this.turn.startTurn(player);

      // 移到下一个玩家
      currentPlayerIdx = this.players.indexOf(player) + 1;
      if (currentPlayerIdx >= this.players.length) currentPlayerIdx = 0;
    }
  }

  /**
   * 按索引获取下一个存活玩家
   */
  getNextAlivePlayerByIndex(idx) {
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      const p = this.players[(idx + i) % n];
      if (p.isAlive) return p;
    }
    return null;
  }

  /**
   * 获取某玩家的下一个存活玩家(按座次)
   */
  getNextAlivePlayer(player) {
    const idx = this.players.indexOf(player);
    return this.getNextAlivePlayerByIndex(idx + 1);
  }

  /**
   * 获取所有存活玩家
   */
  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  /**
   * 组队/阵营：获取某队伍的所有玩家（含已阵亡；ffa 传 null 返回全部玩家）
   */
  getTeamPlayers(team) {
    return this.players.filter(p => p.team === team);
  }

  /**
   * 组队/阵营：仍有存活角色的队伍 id（升序）；ffa 无队伍概念，返回 []
   */
  getAliveTeamIds() {
    const ids = new Set();
    for (const p of this.getAlivePlayers()) {
      if (p.team !== null && p.team !== undefined) ids.add(p.team);
    }
    return [...ids].sort((a, b) => a - b);
  }

  /**
   * 是否敌对：ffa 恒为 true；组队模式同队为 false，队伍未知(null)按敌对处理
   */
  isEnemy(a, b) {
    if (this.teamMode === 'ffa' || !this.teamMode) return true;
    if (!a || !b) return true;
    if (a === b) return false;
    if (a.team === null || a.team === undefined || b.team === null || b.team === undefined) return true;
    return a.team !== b.team;
  }

  /**
   * 检查胜负
   */
  checkWinLose() {
    const alive = this.getAlivePlayers();
    // 自定义条件优先(保持原有优先级)
    if (this.winCondition) {
      const r = this.winCondition(this);
      if (r) return r;
    }
    if (this.loseCondition) {
      const r = this.loseCondition(this);
      if (r === 'lose') return 'lose';
    }
    // 组队模式：我方 = players[0] 的队伍；我方全灭 → lose；仅剩一队存活 → 我方存活则 win
    if (this.teamMode && this.teamMode !== 'ffa') {
      const myTeam = this.players[0]?.team ?? null;
      if (myTeam !== null && myTeam !== undefined) {
        if (!alive.some(p => p.team === myTeam)) return 'lose';
        const aliveTeamIds = this.getAliveTeamIds();
        if (aliveTeamIds.length === 1) {
          return aliveTeamIds[0] === myTeam ? 'win' : 'lose';
        }
        return null;
      }
    }
    // 默认(自由混战): 只剩1人则其胜；玩家(第一个)死则败
    if (alive.length <= 1) {
      return alive[0]?.isAI ? 'lose' : 'win';
    }
    if (!this.players[0]?.isAlive) {
      return 'lose';
    }
    return null;
  }

  /**
   * 投降：立即结束当前对局，并记录投降座位供 UI 显示专属结算文案。
   * 只允许进行中的对局、存活玩家投降一次。
   * @param {Player|number} playerOrSeat 玩家对象或座位号
   * @returns {boolean} 是否成功投降
   */
  surrender(playerOrSeat) {
    if (this.status !== GAME_STATUS.RUNNING) return false;
    const seat = typeof playerOrSeat === 'number'
      ? playerOrSeat
      : playerOrSeat?.seatNum;
    if (seat === null || seat === undefined) return false;
    const player = this.players.find(p => p.seatNum === seat);
    if (!player || !player.isAlive) return false;

    this.surrenderSeat = seat;
    this.status = GAME_STATUS.FINISHED;
    this.addLog(`${player.name} 投降，对局结束`);
    this.notifyStateChange();
    return true;
  }

  /**
   * 请求出牌(注入UI交互)
   */
  async askForPlay(player) {
    if (this.ui.askForPlay) {
      return await this.ui.askForPlay(player);
    }
    // 默认: AI自动出牌
    if (player.isAI) {
      return await this.aiAutoPlay(player);
    }
    return { type: 'endPlay' };
  }

  /**
   * 请求弃牌
   */
  async askForDiscard(player, count) {
    if (this.ui.askForDiscard) {
      return await this.ui.askForDiscard(player, count);
    }
    // AI: 弃价值最低的牌
    if (player.isAI) {
      const sorted = [...player.handCards].sort((a, b) => (a.ai.order || 0) - (b.ai.order || 0));
      return sorted.slice(0, count);
    }
    return player.handCards.slice(0, count);
  }

  /**
   * 请求选择目标
   */
  async askForTarget(player, candidates) {
    if (this.ui.askForTarget) {
      return await this.ui.askForTarget(player, candidates);
    }
    if (player.isAI && candidates.length > 0) {
      // AI 自动选目标：组队模式下跳过队友，只选敌对角色（ffa 下 isEnemy 恒 true）
      const enemies = candidates.filter(t => this.isEnemy(player, t));
      return enemies[0] || null;
    }
    return null;
  }

  /**
   * 请求确认
   * @param {string} message
   * @param {Player|null} player - 需要确认的玩家(联机时用于路由)
   */
  async askForConfirm(message, player = null) {
    // AI 决策不打扰玩家：默认同意（与旧版自动发动行为一致）
    if (player?.isAI) return true;
    if (this.ui.askForConfirm) {
      return await this.ui.askForConfirm(message, player);
    }
    return true;
  }

  /**
   * 执行卡牌动作
   */
  async executeCardAction(player, action) {
    if (!action || !action.card) return;
    const { card, targets } = action;

    // 从手牌移除
    player.discardCard(card);
    const usedTargetName = Array.isArray(targets) && targets[0] ? targets[0].name : null;
    this.emitUiEffect({ type: 'card', player, card, targetName: usedTargetName });

    // 非装备、非延时锦囊先进入弃牌堆（便于【奸雄】等取回造成伤害的牌）
    if (card.type !== 'equip' && card.type !== 'delay_trick') {
      this.deck.discardOne(card);
    }

    switch (card.type) {
      case 'basic':
        await this.executeBasicCard(player, card, targets);
        break;
      case 'trick': {
        const wuxied = await this.tryWuxie(card, targets, player);
        if (!wuxied) {
          await this.executeTrickCard(player, card, targets);
          await this.fireTiming('useCard', { player, card });
          this.tryBondTrickDraw(player, card);
        } else {
          this.addLog(`${card.name} 被无懈可击抵消`);
        }
        break;
      }
      case 'delay_trick': {
        const wuxied = await this.tryWuxie(card, targets, player);
        if (wuxied) {
          this.deck.discardOne(card);
          this.addLog(`${card.name} 被无懈可击抵消`);
        } else {
          await this.executeDelayTrickCard(player, card, targets);
          this.tryBondTrickDraw(player, card);
        }
        break;
      }
      case 'equip': {
        const equipCards = player.getEquipCards();
        // 1) 装备栏已满：无论是否同类型，都必须选择弃置一张（玩家决定替换哪一格）
        if (equipCards.length >= player.equipLimit) {
          let choice = null;
          if (this.ui && typeof this.ui.askForEquipReplace === 'function') {
            try {
              choice = await this.ui.askForEquipReplace(player, card, equipCards, player.equipLimit);
            } catch {
              choice = null;
            }
          }
          // 无 hook / 取消 / 非法选择：fallback 第一张（AI 与引擎测试不挂起）
          const chosenEntry = this.resolveEquipChoice(choice, equipCards) || equipCards[0];
          const old = player.equip(card, chosenEntry.slot);
          if (old) {
            this.deck.discardOne(old);
            this.emitDiscard(player, [old], 'replace');
          }
          this.addLog(`${player.name} 装备栏已满，弃置${old ? old.name : '一张装备'}并装备${card.name}`);
          break;
        }
        // 2) 同 subtype 已有且还有空槽：直接替换旧同类型（不弹窗）
        const sameType = equipCards.find(e => e.card.subtype === card.subtype);
        if (sameType) {
          const old = player.equip(card, sameType.slot);
          if (old) {
            this.deck.discardOne(old);
            this.emitDiscard(player, [old], 'replace');
          }
          this.addLog(`${player.name} 装备了${card.name}${old ? `（替换${old.name}）` : ''}`);
          break;
        }
        // 3) 还有空槽：直接放入
        player.equip(card);
        this.addLog(`${player.name} 装备了${card.name}`);
        break;
      }
    }

    this.notifyStateChange();
  }

  /**
   * 结算一次【杀】(普通出杀与技能转化杀共用)
   * @param {Player} player 使用者
   * @param {Card} card 作为杀使用的牌
   * @param {Player} target 目标
   */
  async resolveShaUse(player, card, target, opts = {}) {
    if (!target || !target.isAlive) return;
    player.usedSha++;
    // 【酒】加伤：多目标【杀】（方天画戟）由 executeBasicCard 统一捕获并传入，保证每个目标都 +1；
    // 单独调用（武圣/丈八蛇矛/追击）时在本次结算内捕获并消耗，命中或被闪避都会消耗掉。
    let jiuBonus;
    if (typeof opts.jiuBonus === 'boolean') {
      jiuBonus = opts.jiuBonus;
      player.usedJiu = false;
    } else {
      jiuBonus = !!player.usedJiu;
      player.usedJiu = false;
    }
    this.addLog(`${player.name} 对 ${target.name} 使用了杀`);

    // 赤兔：出牌阶段你首次使用【杀】时，摸1张牌（每回合1次）
    if (this.turn.currentPhase === 'play'
      && this.hasEquip(player, '赤兔')
      && this.tryEquipOnce(player, 'chitu')) {
      player.drawCards(this.deck.draw(1));
      this.emitUiEffect({ type: 'weapon', player, target, name: '赤兔' });
      this.addLog(`【赤兔】${player.name} 本回合首次使用【杀】，摸1张牌`);
    }

    // 雌雄双股剑：对异性目标使用杀时，目标弃一张手牌，否则你摸一张
    if (this.hasEquip(player, '雌雄双股剑')
      && player.character?.sex && target.character?.sex
      && player.character.sex !== target.character.sex) {
      if (target.handCards.length > 0) {
        const idx = Math.floor(Math.random() * target.handCards.length);
        const discarded = target.handCards[idx];
        target.discardCard(discarded);
        this.deck.discardOne(discarded);
        this.emitDiscard(target, [discarded], 'effect');
        this.addLog(`【雌雄双股剑】${target.name} 弃置一张手牌`);
      } else {
        player.drawCards(this.deck.draw(1));
        this.addLog(`【雌雄双股剑】${player.name} 摸一张牌`);
      }
      this.emitUiEffect({ type: 'weapon', player, target, name: '雌雄双股剑' });
    }

    // 八卦阵：需要出闪时判定，红色视为出闪；青釭剑无视防具
    let armorDodge = false;
    if (this.hasEquip(target, '八卦阵') && !this.hasEquip(player, '青釭剑')) {
      // 统一走 performJudge：会发出 judge 判定揭示演出事件
      const judgeRes = await this.performJudge(target, 'bagua');
      if (judgeRes.card) {
        armorDodge = judgeRes.success;
        this.addLog(`【八卦阵】${target.name} 判定 ${judgeRes.card.suit}${judgeRes.card.numberDisplay}，${armorDodge ? '视为闪' : '判定失败'}`);
        this.emitUiEffect({ type: 'armor', player: target, name: '八卦阵', success: armorDodge });
      }
    }

    const shan = target.handCards.find(c => c.name === '闪');
    let usedShan = null;
    if (!armorDodge && shan) {
      if (target.isAI) {
        usedShan = shan;
      } else if (this.ui.askForCard) {
        usedShan = (await this.ui.askForCard(target, c => c.name === '闪')) || null;
      }
    }

    if (usedShan || armorDodge) {
      if (usedShan) {
        target.discardCard(usedShan);
        this.deck.discardOne(usedShan);
        this.addLog(`${target.name} 使用了闪，躲过攻击`);
      }
      // 大宛：你的【杀】被【闪】抵消后，摸1张牌（每回合1次）
      if (this.hasEquip(player, '大宛') && this.tryEquipOnce(player, 'dawan')) {
        player.drawCards(this.deck.draw(1));
        this.emitUiEffect({ type: 'weapon', player, target, name: '大宛' });
        this.addLog(`【大宛】${player.name} 的【杀】被抵消，摸1张牌`);
      }
      // 拖刀：关羽的【杀】被【闪】抵消后摸1张牌
      if (usedShan && player.hasSkill('cls_tuodao')) {
        player.drawCards(this.deck.draw(1));
        this.addLog(`${player.name} 发动【拖刀】摸1张牌`);
      }
      // 青龙偃月刀：被闪避后可追加一张杀（最多追加一次，可选择是否发动）
      const extraSha = player.handCards.find(c => c.name === '杀');
      let chased = false;
      if (opts.allowChase !== false
        && this.hasEquip(player, '青龙偃月刀') && extraSha
        && await this.askForConfirm('是否发动【青龙偃月刀】追加一张【杀】？', player)) {
        player.discardCard(extraSha);
        this.deck.discardOne(extraSha);
        this.emitDiscard(player, [extraSha], 'cost');
        this.emitUiEffect({ type: 'card', player, card: extraSha });
        this.emitUiEffect({ type: 'weapon', player, target, name: '青龙偃月刀' });
        this.addLog(`【青龙偃月刀】${player.name} 追加一张杀`);
        chased = true;
        await this.resolveShaUse(player, extraSha, target, { allowChase: false });
      }
      if (!chased && opts.allowAx !== false
        && this.hasEquip(player, '贯石斧') && player.handCards.length >= 2
        && await this.askForConfirm('是否发动【贯石斧】弃两张牌强制造成伤害？', player)) {
        const sorted = [...player.handCards].sort((a, b) => (a.ai?.order || 0) - (b.ai?.order || 0));
        const cost = sorted.slice(0, 2);
        for (const c of cost) {
          player.discardCard(c);
          this.deck.discardOne(c);
        }
        this.emitDiscard(player, cost, 'cost');
        this.emitUiEffect({ type: 'weapon', player, target, name: '贯石斧' });
        this.addLog(`【贯石斧】${player.name} 弃两张牌强制造成伤害`);
        // 强制伤害仍属于这张【杀】造成的伤害：酒加伤生效，并且可以触发麒麟弓
        const forcedDamage = (jiuBonus ? 2 : 1) + this.tryBondCombo(player, target);
        const forcedDealt = await this.dealDamage({ source: player, target, num: forcedDamage, card });
        this.addLog(forcedDealt > 0
          ? `${target.name} 受到${forcedDealt}点伤害(当前体力${target.hp})`
          : `${target.name} 的伤害被防止`);
        if (forcedDealt > 0) await this.triggerShaDamageMounts(player, target, forcedDealt, card);
      }
    } else {
      // 寒冰剑：可改为弃置目标两张牌，防止伤害（可选择是否发动）
      const targetCardCount = target.handCards.length
        + target.getEquipCards().length
        + (target.judgeCards?.length || 0);
      if (this.hasEquip(player, '寒冰剑') && targetCardCount >= 2
        && await this.askForConfirm(`是否发动【寒冰剑】弃置${target.name}两张牌并防止此伤害？`, player)) {
        const c1 = this.takeAnyCard(target);
        const c2 = this.takeAnyCard(target);
        const iceDiscarded = [c1, c2].filter(Boolean);
        iceDiscarded.forEach(c => this.deck.discardOne(c));
        this.emitDiscard(target, iceDiscarded, 'effect');
        this.emitUiEffect({ type: 'weapon', player, target, name: '寒冰剑' });
        this.addLog(`【寒冰剑】${player.name} 弃置${target.name}两张牌，防止伤害`);
      } else {
        let damage = jiuBonus ? 2 : 1;
        // 武将羁绊合击：命中且队友存活时，每局一次额外 +1
        damage += this.tryBondCombo(player, target);
        // 的卢：成为【杀】目标且最终未打出【闪】时，防止1点伤害（每回合1次）
        if (this.hasEquip(target, '的卢') && this.tryEquipOnce(target, 'dilu')) {
          damage = Math.max(0, damage - 1);
          this.emitUiEffect({ type: 'weapon', player: target, target, name: '的卢' });
          this.addLog(`【的卢】${target.name} 防止1点伤害`);
        }
        const dealt = await this.dealDamage({ source: player, target, num: damage, card });
        this.addLog(dealt > 0
          ? `${target.name} 受到${dealt}点伤害(当前体力${target.hp})`
          : `${target.name} 的伤害被防止`);

        // 杀造成伤害后的装备联动：绝影(受伤摸牌) / 紫骍(弃目标牌) / 麒麟弓(射坐骑)
        if (dealt > 0) await this.triggerShaDamageMounts(player, target, dealt, card);
      }
    }
    this.notifyStateChange();
  }

  /**
   * 【杀】造成伤害后的统一后处理（仅在真正造成伤害时触发）：
   * - 通用时机 fireTiming('shaDamage')：【咆哮】等技能据此接入，避免核心硬编码
   * - 绝影（防守方）：受到【杀】伤害后摸1张牌（每回合1次）
   * - 紫骍（进攻方）：你的【杀】造成伤害后，弃置目标1张牌（每回合1次）
   * - 麒麟弓：弃置目标一匹坐骑
   */
  async triggerShaDamageMounts(player, target, dealt = 1, card = null) {
    if (!player || !target || dealt <= 0) return;
    // 新增通用触发时机：使用【杀】造成伤害后（供【咆哮】及自定义技能接入）
    await this.fireTiming('shaDamage', { player, target, source: player, card, num: dealt });
    if (target.isAlive && this.hasEquip(target, '绝影') && this.tryEquipOnce(target, 'jueying')) {
      target.drawCards(this.deck.draw(1));
      this.emitUiEffect({ type: 'weapon', player: target, target, name: '绝影' });
      this.addLog(`【绝影】${target.name} 受到【杀】伤害后，摸1张牌`);
    }
    if (target.isAlive && this.hasEquip(player, '紫骍') && this.tryEquipOnce(player, 'zixing')) {
      const discarded = this.takeAnyCard(target);
      if (discarded) {
        this.deck.discardOne(discarded);
        this.emitDiscard(target, [discarded], 'effect');
        this.emitUiEffect({ type: 'weapon', player, target, name: '紫骍' });
        this.addLog(`【紫骍】${player.name} 弃置${target.name}一张牌`);
      }
    }
    await this.triggerQilinBow(player, target);
  }

  /**
   * 麒麟弓：使用【杀】造成伤害后，弃置目标角色装备区里的一张坐骑
   * 抽成公共方法，普通命中与【贯石斧】强制伤害都可以正确触发（且只触发一次）
   * @returns {Promise<boolean>} 是否弃置了坐骑
   */
  async triggerQilinBow(player, target) {
    if (!target || !target.isAlive || !this.hasEquip(player, '麒麟弓')) return false;
    const horseEntry = target.getEquipCards().find(e =>
      [EQUIP_SLOTS.HORSE_DEF, EQUIP_SLOTS.HORSE_ATK].includes(e.card.subtype)
    );
    if (!horseEntry) return false;
    const horse = target.unequip(horseEntry.slot);
    this.deck.discardOne(horse);
    this.emitDiscard(target, [horse], 'effect');
    this.emitUiEffect({ type: 'weapon', player, target, name: '麒麟弓' });
    this.addLog(`【麒麟弓】弃置${target.name}的${horse.name}`);
    return true;
  }

  /**
   * 无懈可击：在锦囊生效前询问受影响角色
   * 支持无懈互相抵消链：受影响方与来源方交替出无懈，直到一方放弃或没有无懈
   * @returns {Promise<boolean>} 锦囊最终是否被抵消
   */
  async tryWuxie(card, targets, source) {
    const harmful = ['决斗', '南蛮入侵', '万箭齐发', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断', '闪电'];
    if (!harmful.includes(card.name)) return false;
    // 受影响方 = 真正会吃到这张锦囊的存活角色（AOE 为除来源外所有存活者；单体为指定目标）。
    const affected = (card.name === '南蛮入侵' || card.name === '万箭齐发')
      ? this.getAlivePlayers().filter(p => p !== source)
      : (targets || []).filter(p => p && p.isAlive && p !== source);
    // 延时锦囊（尤其【闪电】置于自己判定区）targets 可能是空数组：
    // 此时受影响者就是使用者自己，无懈可击仍可对其生效（规则：延时锦囊放置时可被无懈）。
    if (affected.length === 0 && card.type === 'delay_trick' && source) {
      affected.push(source);
    }
    const affectedSet = new Set(affected);
    if (affectedSet.size === 0) return false;

    // 交替询问：受影响方(想抵消) ⇄ 来源方(想反制)；偶数次无懈 = 锦囊被抵消
    let cancelled = false;
    let askAffectedSide = true;
    for (let depth = 0; depth < 8; depth++) {
      const side = askAffectedSide ? affectedSet : new Set([source]);
      const user = await this.findWuxieUser(side);
      if (!user) break;
      const wuxie = user.handCards.find(c => c.name === '无懈可击');
      user.discardCard(wuxie);
      this.deck.discardOne(wuxie);
      this.emitDiscard(user, [wuxie], 'cost');
      this.emitUiEffect({ type: 'card', player: user, card: wuxie });
      this.emitUiEffect({ type: 'wuxie', player: user, target: source, name: '无懈可击' });
      cancelled = !cancelled;
      this.addLog(cancelled
        ? `${user.name} 使用无懈可击，抵消了${card.name}`
        : `${user.name} 使用无懈可击，反制了上一张无懈可击`);
      askAffectedSide = !askAffectedSide;
    }
    return cancelled;
  }

  /**
   * 在指定玩家集合中寻找愿意使用无懈可击的玩家
   * AI 默认使用；真人通过 askForCard 询问，放弃则继续找下一个
   */
  async findWuxieUser(sideSet) {
    for (const p of this.getAlivePlayers()) {
      if (!p.isAlive || !sideSet.has(p)) continue;
      if (!p.handCards.some(c => c.name === '无懈可击')) continue;
      if (p.isAI) return p;
      if (this.ui.askForCard) {
        const chosen = await this.ui.askForCard(p, c => c.name === '无懈可击');
        if (chosen) return p;
        continue;
      }
      return p;
    }
    return null;
  }

  /**
   * 执行基本牌
   */
  async executeBasicCard(player, card, targets) {
    switch (card.name) {
      case '杀': {
        let shaTargets = Array.isArray(targets) ? targets.filter(t => t && t.isAlive) : [];
        if (shaTargets.length === 0) return;
        // 方天画戟：仅当【杀】为最后一张手牌时可额外指定至多两个目标
        if (shaTargets.length > 1) {
          const isLastHandCard = player.handCards.length === 0;
          if (!isLastHandCard || !this.hasEquip(player, '方天画戟')) {
            this.addLog(`${player.name} 不满足【方天画戟】多目标条件，仅结算第一个目标`);
            shaTargets = shaTargets.slice(0, 1);
          } else {
            shaTargets = shaTargets.slice(0, 3);
          }
        }
        // 【酒】加伤在整张【杀】结算前确定一次，然后传给每个目标：
        // 同一张【杀】的所有目标都 +1，而不是只有第一个目标享受加成
        const jiuBonus = !!player.usedJiu;
        player.usedJiu = false;
        if (jiuBonus) this.addLog(`【酒】${player.name} 本张【杀】伤害+1`);
        for (let i = 0; i < shaTargets.length; i++) {
          if (i > 0) player.usedSha = Math.max(0, player.usedSha - 1);
          await this.resolveShaUse(player, card, shaTargets[i], { jiuBonus });
          if (!player.isAlive) break;
        }
        break;
      }
      case '闪':
        // 闪只能响应【杀】，出牌阶段禁止主动使用
        return;
      case '桃': {
        if (player.hp >= player.maxHp) return;
        player.recover(1);
        this.addLog(`${player.name} 使用了桃，回复1点体力(当前${player.hp})`);
        this.emitHeal(player, 1, player);
        break;
      }
      case '酒': {
        if ((player.usedJiuCount || 0) >= 1) return;
        player.usedJiu = true;
        player.usedJiuCount = (player.usedJiuCount || 0) + 1;
        this.addLog(`${player.name} 使用了酒，下一张杀伤害+1`);
        break;
      }
      default:
        if (card.effect) await card.effect(this, player, targets);
    }
  }

  /**
   * 执行锦囊牌
   */
  async executeTrickCard(player, card, targets) {
    switch (card.name) {
      case '决斗': {
        const target = targets?.[0];
        if (!target || !target.isAlive) return;
        this.addLog(`${player.name} 对 ${target.name} 使用了决斗`);
        // 决斗: 由目标角色先出杀，双方轮流出杀，先不出杀的受1点伤害（真人由 UI 询问）
        let attacker = target;
        let defender = player;
        let exchanges = 0;
        // 双保险：即使 UI/AI 返回无效响应牌，也绝不允许决斗无限循环
        const MAX_EXCHANGES = 100;
        while (attacker.isAlive && defender.isAlive) {
          if (++exchanges > MAX_EXCHANGES) {
            this.addLog('决斗结算次数异常，强制结束');
            break;
          }
          const sha = attacker.isAI
            ? attacker.handCards.find(c => c.name === '杀')
            : (this.ui.askForCard ? await this.ui.askForCard(attacker, c => c.name === '杀') : null);
          // 响应牌必须真的在手中，否则无法弃置会导致死循环
          if (!sha || !attacker.handCards.includes(sha)) {
            this.addLog(`${attacker.name} 无法出杀`);
            const duelDealt = await this.dealDamage({
              source: defender, target: attacker, num: 1, card, reason: 'duel',
            });
            this.addLog(duelDealt > 0
              ? `${attacker.name} 受到${duelDealt}点伤害`
              : `${attacker.name} 的伤害被防止`);
            break;
          }
          attacker.discardCard(sha);
          this.deck.discardOne(sha);
          this.addLog(`${attacker.name} 出杀`);
          [attacker, defender] = [defender, attacker];
        }
        break;
      }
      case '南蛮入侵': {
        this.addLog(`${player.name} 使用了南蛮入侵`);
        for (const p of this.getAlivePlayers().filter(p => p !== player)) {
          if (!p.isAlive) continue;
          const sha = p.isAI
            ? p.handCards.find(c => c.name === '杀')
            : (this.ui.askForCard ? await this.ui.askForCard(p, c => c.name === '杀') : null);
          if (sha) {
            p.discardCard(sha);
            this.deck.discardOne(sha);
            this.addLog(`${p.name} 出杀响应`);
          } else {
            this.addLog(`${p.name} 无法出杀`);
            const nmDealt = await this.dealDamage({ source: player, target: p, num: 1, card });
            this.addLog(nmDealt > 0 ? `${p.name} 受到${nmDealt}点伤害` : `${p.name} 的伤害被防止`);
          }
        }
        break;
      }
      case '万箭齐发': {
        this.addLog(`${player.name} 使用了万箭齐发`);
        for (const p of this.getAlivePlayers().filter(p => p !== player)) {
          if (!p.isAlive) continue;
          let shan = null;
          let armorDodge = false;
          if (p.isAI) {
            shan = p.handCards.find(c => c.name === '闪');
          } else if (this.ui.askForCard) {
            shan = await this.ui.askForCard(p, c => c.name === '闪') || null;
          }
          // 八卦阵：受到万箭齐发需要出闪时可判定，红色视为闪
          // （青釭剑只影响【杀】，不应影响【万箭齐发】的八卦阵判定）
          if (!shan && this.hasEquip(p, '八卦阵')) {
            // 统一走 performJudge：会发出 judge 判定揭示演出事件
            const judgeRes = await this.performJudge(p, 'bagua');
            if (judgeRes.card) {
              armorDodge = judgeRes.success;
              this.addLog(`【八卦阵】${p.name} 判定 ${judgeRes.card.suit}${judgeRes.card.numberDisplay}，${armorDodge ? '视为闪' : '判定失败'}`);
              this.emitUiEffect({ type: 'armor', player: p, name: '八卦阵', success: armorDodge });
            }
          }
          if (shan || armorDodge) {
            if (shan) {
              p.discardCard(shan);
              this.deck.discardOne(shan);
            }
            this.addLog(`${p.name} 出闪响应`);
          } else {
            this.addLog(`${p.name} 无法出闪`);
            const wjDealt = await this.dealDamage({ source: player, target: p, num: 1, card });
            this.addLog(wjDealt > 0 ? `${p.name} 受到${wjDealt}点伤害` : `${p.name} 的伤害被防止`);
          }
        }
        break;
      }
      case '桃园结义': {
        this.addLog(`${player.name} 使用了桃园结义`);
        for (const p of this.getAlivePlayers()) {
          if (p.hp < p.maxHp) {
            p.recover(1);
            this.addLog(`${p.name} 回复1点体力`);
            this.emitHeal(p, 1, player);
          }
        }
        break;
      }
      case '顺手牵羊': {
        const target = targets?.[0];
        if (!target || this.distance.getAttackDistance(player, target) > 1 || !this.hasAnyCard(target)) return;
        const stolen = this.takeAnyCard(target);
        if (!stolen) return;
        player.drawCards([stolen]);
        // 演出事件：牌离开目标（实际进入使用者手牌，reason=effect 表示由锦囊效果造成）
        this.emitDiscard(target, [stolen], 'effect');
        this.addLog(`${player.name} 顺了${target.name}一张${stolen.name}`);
        break;
      }
      case '过河拆桥': {
        const target = targets?.[0];
        if (!target || !this.hasAnyCard(target)) return;
        const removed = this.takeAnyCard(target);
        if (!removed) return;
        this.deck.discardOne(removed);
        this.emitDiscard(target, [removed], 'effect');
        this.addLog(`${player.name} 拆了${target.name}一张${removed.name}`);
        break;
      }
      case '无中生有': {
        const cards = this.deck.draw(2);
        player.drawCards(cards);
        this.addLog(`${player.name} 使用无中生有，摸2张牌`);
        break;
      }
      default:
        if (card.effect) await card.effect(this, player, targets);
    }
  }

  /**
   * 执行延时锦囊
   */
  async executeDelayTrickCard(player, card, targets) {
    let target;
    if (card.name === '闪电') target = player;
    else target = targets?.[0];
    if (!target || !target.isAlive) return;
    // 同一判定区不能重复放置同名延时锦囊
    if ((target.judgeCards || []).some(c => c.name === card.name)) {
      this.deck.discardOne(card);
      this.addLog(`${target.name} 的判定区已有${card.name}，无法重复放置`);
      return;
    }
    target.addJudgeCard(card);
    this.addLog(`${player.name} 对 ${target.name} 使用了${card.name}`);
  }

  /**
   * 处理濒死
   * @param {Player} player 濒死角色
   * @param {object} opts
   * @param {Player|null} opts.source - 伤害来源（用于 dying/death 演出事件）
   * @param {string} opts.reason - 死因(damage/lightning/duel/other)
   */
  async handleDying(player, { source = null, reason = 'other' } = {}) {
    if (!player.isDying) return;
    this.addLog(`${player.name} 进入濒死状态！`);
    // 濒死演出事件（伤害 → dying → death 顺序中的第二步）
    this.emitUiEffect({ type: 'dying', player: this.effectPlayer(player), source: this.effectPlayer(source) });
    await this.fireTiming('dying', { player });
    if (player.hp > 0) return;

    // 轮流求桃：先自己，再其他存活角色；真人由 UI 询问，AI 自动
    // 体力可能低于 -1，需要多张【桃】才能救回
    let guard = 0;
    while (player.hp <= 0 && guard++ < 20) {
      let used = false;

      // 1) 自己出桃
      if (player.isAI) {
        const taoCard = player.handCards.find(c => c.name === '桃') || null;
        used = player.askForPeach();
        if (used) {
          this.addLog(`${player.name} 使用桃自救`);
          this.emitHeal(player, 1, null);
          this.emitDiscard(player, [taoCard], 'cost');
        }
      } else if (this.ui.askForCard) {
        const chosen = await this.ui.askForCard(player, c => c.name === '桃');
        if (chosen) {
          player.discardCard(chosen);
          this.deck.discardOne(chosen);
          player.recover(1);
          used = true;
          this.addLog(`${player.name} 使用桃自救`);
          this.emitHeal(player, 1, null);
          this.emitDiscard(player, [chosen], 'cost');
        }
      } else {
        const taoCard = player.handCards.find(c => c.name === '桃') || null;
        used = player.askForPeach();
        if (used) {
          this.addLog(`${player.name} 使用桃自救`);
          this.emitHeal(player, 1, null);
          this.emitDiscard(player, [taoCard], 'cost');
        }
      }

      // 2) 其他角色出桃（真人需确认，AI 自动）
      if (!used) {
        let helper = null;
        for (const p of this.getAlivePlayers()) {
          if (p === player || !p.isAlive) continue;
          const tao = p.handCards.find(c => c.name === '桃');
          if (!tao) continue;
          if (p.isAI) {
            // 组队模式：AI 只给同队角色出桃（ffa 保持原有“见死就救”行为）
            if (this.teamMode === 'ffa' || !this.isEnemy(p, player)) {
              helper = { p, tao };
              break;
            }
            continue;
          }
          if (await this.askForConfirm(`是否对 ${player.name} 使用一张【桃】？`, p)) {
            helper = { p, tao };
            break;
          }
        }
        if (helper) {
          helper.p.discardCard(helper.tao);
          this.deck.discardOne(helper.tao);
          this.emitDiscard(helper.p, [helper.tao], 'cost');
          player.recover(1);
          used = true;
          this.addLog(`${helper.p.name} 对 ${player.name} 使用桃`);
          this.emitHeal(player, 1, helper.p);
        }
      }

      if (!used) break;
    }

    if (player.hp > 0) {
      player.status = 'alive';
      this.addLog(`${player.name} 脱离濒死`);
      return;
    }

    // 无桃可出，死亡
    await this.fireTiming('die', { player });
    // 阵亡清理：手牌、装备区、判定区的牌全部进入弃牌堆（此前只清空数组，牌会凭空消失）
    const lostCards = [
      ...player.handCards,
      ...player.getEquipCards().map(e => e.card),
      ...(player.judgeCards || []),
    ];
    player.die();
    for (const card of lostCards) {
      if (!this.deck.discardPile.includes(card)) this.deck.discardOne(card);
    }
    // 死亡玩家不再参与距离/座次计算
    this.distance.updatePlayers(this.players);
    this.addLog(`${player.name} 阵亡！`);
    // 阵亡时手牌/装备/判定区的牌同时作为一批弃牌事件发给 UI
    this.emitDiscard(player, lostCards, 'other');
    // 阵亡/处决演出事件（伤害 → dying → death 顺序中的最后一步）
    this.emitUiEffect({
      type: 'death',
      player: this.effectPlayer(player),
      source: this.effectPlayer(source),
      reason: reason || 'other',
    });
    await this.fireTiming('dieAfter', { player });
  }

  /**
   * AI自动出牌
   */
  async aiAutoPlay(player) {
    // 简单AI逻辑
    const handCards = player.handCards;

    // 优先出桃(如果受伤)
    if (player.hp < player.maxHp) {
      const tao = handCards.find(c => c.name === '桃');
      if (tao) return { card: tao, targets: [player] };
    }

    // 装备优先：先装备可提升攻击范围的武器（或空槽位），后续【杀】才够得着目标。
    // 已有装备时不降级替换（例如不会用范围1的连弩换掉范围3的青龙偃月刀）。
    const equip = handCards.find(c => {
      if (c.type !== 'equip' || !c.subtype) return false;
      const current = player.getEquipByType(c.subtype);
      if (current) {
        if (c.subtype === EQUIP_SLOTS.WEAPON) {
          return (c.range || 1) > (current.range || 1);
        }
        return false;
      }
      // 无同类型时，只有还有空装备槽才主动装备（满槽不主动换装，避免 AI 弃掉关键装备）
      return !!player.getEmptyEquipSlot();
    });
    if (equip) return { card: equip, targets: [] };

    // 【酒】：手里有【杀】且存在可攻击目标时，先喝酒让这张【杀】伤害+1
    if (player.canSha
      && (player.usedJiuCount || 0) < 1
      && handCards.some(c => c.name === '杀')
      && this.getAITargets(player, '杀').length > 0) {
      const jiu = handCards.find(c => c.name === '酒');
      if (jiu) return { card: jiu, targets: [player] };
    }

    // 出杀(如果有目标在攻击范围内；组队模式排除队友)
    if (player.canSha) {
      const sha = handCards.find(c => c.name === '杀');
      if (sha) {
        const targets = this.getAITargets(player, '杀');
        if (targets.length > 0) {
          return { card: sha, targets: [targets[0]] };
        }
      }
    }

    // 出决斗：手里要有【杀】才主动决斗，否则等于白送1点伤害
    const juedou = handCards.find(c => c.name === '决斗');
    if (juedou && handCards.some(c => c.name === '杀')) {
      const targets = this.getAITargets(player, '决斗');
      if (targets.length > 0) return { card: juedou, targets: [targets[0]] };
    }

    // 出无中生有
    const wzsy = handCards.find(c => c.name === '无中生有');
    if (wzsy) return { card: wzsy, targets: [] };

    // 出过河拆桥（组队模式排除队友）
    const ghcq = handCards.find(c => c.name === '过河拆桥');
    if (ghcq) {
      const targets = this.getAITargets(player, '过河拆桥');
      if (targets.length > 0) return { card: ghcq, targets: [targets[0]] };
    }

    // 出顺手牵羊（组队模式排除队友）
    const ssqy = handCards.find(c => c.name === '顺手牵羊');
    if (ssqy) {
      const targets = this.getAITargets(player, '顺手牵羊');
      if (targets.length > 0) return { card: ssqy, targets: [targets[0]] };
    }

    // 主动技：先把普通牌打完，再用制衡/仁德/武圣处理剩余手牌，避免烧掉关键牌
    const skillAction = this.aiChooseActiveSkill(player);
    if (skillAction) return skillAction;

    // 延时锦囊：优先控制手牌最多的敌人；闪电只在体力充足时放自己判定区
    for (const name of ['乐不思蜀', '兵粮寸断']) {
      const card = handCards.find(c => c.name === name);
      if (!card) continue;
      const targets = this.getAITargets(player, name);
      if (targets.length === 0) continue;
      const target = [...targets].sort((a, b) =>
        (b.handCards.length - a.handCards.length) || (b.hp - a.hp))[0];
      return { card, targets: [target] };
    }
    const lightning = handCards.find(c => c.name === '闪电');
    if (lightning
      && player.hp >= 4
      && !(player.judgeCards || []).some(c => c.name === '闪电')) {
      return { card: lightning, targets: [player] };
    }

    // 出南蛮/万箭
    const aoe = handCards.find(c => c.name === '南蛮入侵' || c.name === '万箭齐发');
    if (aoe) return { card: aoe, targets: [] };

    // 无牌可出或不想出
    return { type: 'endPlay' };
  }

  /**
   * 添加日志
   */
  addLog(message) {
    const log = {
      time: Date.now(),
      message,
      round: this.turn.roundNumber,
      phase: this.turn.currentPhase,
    };
    this.logs.push(log);
    // 引擎侧日志上限：整局只增不减会持续占用内存（UI 侧另有 slice(-50)）
    if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500);
    if (this.onLog) this.onLog(log);
  }

  /**
   * 通知状态变化
   * 同一个同步执行块（事件循环同一 tick）内的多次通知合并为一次，
   * 避免 fireTiming 连环触发技能时反复全量构建快照/序列化广播。
   */
  notifyStateChange() {
    if (!this.ui.onStateChange || this._notifyScheduled) return;
    this._notifyScheduled = true;
    queueMicrotask(() => {
      this._notifyScheduled = false;
      // 对局可能已在微任务前被销毁/重开（ui 回调已清空）
      if (this.ui.onStateChange) this.ui.onStateChange(this.getGameState());
    });
  }

  /**
   * 获取游戏状态(供UI渲染)
   */
  getGameState() {
    return {
      status: this.status,
      surrenderSeat: this.surrenderSeat ?? null,
      teamMode: this.teamMode || this.config.teamMode || 'ffa',
      friendlyFire: this.friendlyFire === true,
      autoTrigger: this.autoTrigger === true,
      round: this.turn.roundNumber,
      currentPhase: this.turn.currentPhase,
      currentPlayer: this.turn.currentPlayer?.toJSON(),
      players: this.players.map(p => p.toJSON()),
      bonds: this.getBondState(),
      deckInfo: this.deck.getInfo(),
      logs: this.logs.slice(-50), // 最近50条
    };
  }
}
