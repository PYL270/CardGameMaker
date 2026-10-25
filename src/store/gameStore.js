/**
 * gameStore - Zustand全局状态管理
 */
import { create } from 'zustand';
import Game from '../core/Game';
import Character from '../core/Character';
import Skill from '../core/Skill';
import { net } from '../net/netClient';
import {
  serializeState,
  serializeEffect,
  promptPlay,
  promptDiscard,
  promptRespond,
  promptConfirm,
  promptSelectCards,
  promptChooseTarget,
} from '../net/serialize';

const STORAGE_KEY = 'cgm_data';

// 联机聊天：历史/文本限制 + 本地屏蔽（localStorage，仅本机，绝不上传）
const CHAT_HISTORY_LIMIT = 50;
const CHAT_TEXT_LIMIT = 200;
const CHAT_MUTE_KEY = 'cgm_chat_muted';

function loadChatMuted() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CHAT_MUTE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const list = [];
    for (const entry of arr) {
      if (typeof entry === 'string' && entry.trim()) {
        list.push(entry.trim());
      } else if (entry && typeof entry === 'object') {
        const id = typeof entry.id === 'string' ? entry.id.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (id || name) list.push({ id: id || name, name });
      }
    }
    return list;
  } catch {
    return [];
  }
}

function persistChatMuted(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CHAT_MUTE_KEY, JSON.stringify(list));
  } catch {
    // 本地存储失败不影响聊天
  }
}

/** 聊天文本规范化：去控制字符、折叠空白、trim、最多 200 字符 */
function normalizeChatText(text) {
  if (typeof text !== 'string') return '';
  const compact = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '';
  return Array.from(compact).slice(0, CHAT_TEXT_LIMIT).join('');
}

/** 从消息/字符串生成屏蔽条目（senderId 优先，其次 name；字符串按 id 处理） */
function muteEntryOf(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    const id = target.trim();
    return id ? { id, name: '' } : null;
  }
  const id = (typeof target.senderId === 'string' && target.senderId)
    || (typeof target.id === 'string' && target.id)
    || '';
  const name = typeof target.name === 'string' ? target.name.trim() : '';
  if (!id && !name) return null;
  return { id: id || name, name };
}

/** 判断屏蔽条目是否匹配目标（支持按 senderId 或 name） */
function muteEntryMatches(entry, target) {
  const id = typeof target === 'string'
    ? target.trim()
    : ((target && (target.senderId || target.id)) || '');
  const name = target && typeof target === 'object' && typeof target.name === 'string'
    ? target.name.trim()
    : '';
  if (typeof entry === 'string') {
    return entry === id || (!!name && entry === name);
  }
  if (!entry || typeof entry !== 'object') return false;
  const entryId = typeof entry.id === 'string' ? entry.id : '';
  const entryName = typeof entry.name === 'string' ? entry.name : '';
  if (entryId && (entryId === id || (!!name && entryId === name))) return true;
  if (entryName && (entryName === name || (!!id && entryName === id))) return true;
  return false;
}

/** 合并聊天历史：按 id 去重，按时间排序，最多保留 50 条 */
function mergeChatMessages(existing, incoming) {
  const map = new Map();
  for (const m of [...(existing || []), ...(incoming || [])]) {
    if (!m || typeof m !== 'object' || !m.id) continue;
    if (typeof m.text !== 'string') continue;
    map.set(m.id, m);
  }
  return [...map.values()]
    .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))
      || String(a.id).localeCompare(String(b.id)))
    .slice(-CHAT_HISTORY_LIMIT);
}

// 对局代次：重开/退出时递增，用于丢弃旧对局的异步回调
let runToken = 0;

// 联机(房主端)：等待各客户端操作的请求表
let hostRequests = new Map();
let hostSeq = 0;
let netInited = false;

/** AI 行动节奏停顿（仅浏览器端；测试环境不延迟） */
export const AI_DELAY_MIN = 700;
export const AI_DELAY_MAX = 1800;
export const AI_DELAY_DEFAULT = 900;

/** 纯函数：设置值 → 生效 AI 出牌间隔（clamp 700~1800，默认 900） */
export function normalizeAiDelay(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return AI_DELAY_DEFAULT;
  return Math.min(AI_DELAY_MAX, Math.max(AI_DELAY_MIN, Math.round(n)));
}

/** 读取设置页 cgm_game_config.aiDelay（旧配置 <700 运行时 clamp 到 700） */
function readAiDelay() {
  try {
    if (typeof localStorage === 'undefined') return AI_DELAY_DEFAULT;
    const cfg = JSON.parse(localStorage.getItem('cgm_game_config') || '{}');
    return normalizeAiDelay(cfg?.aiDelay);
  } catch {
    return AI_DELAY_DEFAULT;
  }
}

const aiPause = (ms) => {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
};

/** 组队模式白名单（引擎契约：ffa / 2v2 / 3v3） */
function normalizeTeamModeOption(mode) {
  return (mode === '2v2' || mode === '3v3') ? mode : 'ffa';
}

/** 允许攻击队友（误伤）：仅组队模式生效，其余视为 false */
function normalizeFriendlyFireOption(teamMode, value) {
  return teamMode !== 'ffa' && value === true;
}

/** 可选触发技自动发动：严格布尔 */
function normalizeAutoTriggerOption(value) {
  return value === true;
}

/** 从 cgm_game_config 读取设置页保存的默认 autoTrigger（隐私模式下回退 false） */
function readStoredAutoTrigger() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('cgm_game_config');
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return cfg?.autoTrigger === true;
  } catch {
    return false;
  }
}

/**
 * 停止旧对局：解绑回调、放行挂起操作，避免旧循环干扰新对局
 */
/** 给挂起操作一个安全的返回值，放行旧对局循环 */
function resolvePendingAction(pendingAction) {
  if (!pendingAction?.resolve) return;
  // confirm 必须回 false、选牌必须回空数组、选目标/响应必须回 null，不能一律当作出牌动作
  const safeValue =
    (pendingAction.type === 'discard' || pendingAction.type === 'selectCards') ? []
      : (pendingAction.type === 'respond' || pendingAction.type === 'chooseTarget'
        || pendingAction.type === 'equipReplace') ? null
        : pendingAction.type === 'confirm' ? false
          : { type: 'endPlay' };
  pendingAction.resolve(safeValue);
}

function disposeGame(game, pendingAction) {
  if (!game) return;
  try {
    game.ui.onStateChange = null;
    game.ui.onEffect = null;
    game.ui.askForPlay = null;
    game.ui.askForDiscard = null;
    game.ui.askForCard = null;
    game.ui.askForConfirm = null;
    game.ui.askForEquipReplace = null;
    game.onLog = null;
    game.status = 'finished';
    hostRequests.clear();
    resolvePendingAction(pendingAction);
  } catch {
    // 忽略清理异常
  }
}

/** 装备栏替换选项：数组/对象 → [{slotKey,card}] */
export function normalizeEquipChoiceEntries(current) {
  if (Array.isArray(current)) {
    return current
      .map((card, index) => (card ? { slotKey: card.slotKey ?? card.slot ?? String(index), card } : null))
      .filter(Boolean);
  }
  if (current && typeof current === 'object') {
    return Object.entries(current)
      .filter(([, card]) => card)
      .map(([slotKey, card]) => ({ slotKey, card }));
  }
  return [];
}

function firstEquipSlot(current) {
  return normalizeEquipChoiceEntries(current)[0]?.slotKey ?? null;
}

function defaultOnline() {
  return {
    active: false,
    connecting: false,
    connected: false,
    isHost: false,
    roomCode: null,
    seat: 0,
    // 'player' | 'spectator'（观战者不占座位、不能操作）
    role: 'player',
    spectator: false,
    // 成员稳定 id（服务端分配：玩家 p<seat>/观战 s<n>），聊天用于识别“自己”
    clientId: null,
    // 房间聊天（最近 50 条）与未读数
    chatMessages: [],
    chatUnread: 0,
    members: [],
    playerCount: 0,
    spectatorCount: 0,
    serverUrl: '',
    name: '',
    error: null,
    notice: null,
    lanIps: [],
  };
}

/**
 * 处理中继消息
 * - 房主：接收客户端操作并唤醒挂起请求
 * - 客户端：接收开始/状态/提示/打击反馈
 */
function handleNetRelay(msg, api) {
  const { set, get } = api;
  const online = get().online;

  if (msg.kind === 'action') {
    if (!online.isHost) return;
    const pending = hostRequests.get(msg.requestId);
    if (pending) {
      hostRequests.delete(msg.requestId);
      pending.resolve(msg.payload || null);
    }
    return;
  }

  // 联机投降：只接受房主端处理；座位以服务器注入的 from 为准，防止冒用他人座位
  if (msg.kind === 'surrender') {
    if (!online.isHost) return;
    const game = get().game;
    if (!game || game.status !== 'running') return;
    const seat = Number(msg.from);
    if (!Number.isInteger(seat) || seat <= 0) return;
    const player = game.players.find(p => p.seatNum === seat && !p.isAI);
    if (!player) return;
    if (game.surrender(player)) set({ pendingAction: null });
    return;
  }

  if (msg.kind === 'start') {
    const spectator = msg.spectate === true
      || online.role === 'spectator'
      || online.spectator === true;
    set({
      online: {
        ...online,
        active: true,
        isHost: false,
        role: spectator ? 'spectator' : 'player',
        spectator,
      },
      gameState: null,
      pendingAction: null,
      effect: null,
      logs: [],
    });
    return;
  }

  if (msg.kind === 'state') {
    const state = msg.state || null;
    set({ gameState: state, logs: state?.logs ? [...state.logs] : [] });
    return;
  }

  if (msg.kind === 'effect') {
    const e = msg.effect || {};
    set({
      effect: {
        type: e.type,
        num: e.num || 0,
        playerId: e.playerId || e.sourceId || null,
        sourceId: e.sourceId || null,
        cardName: e.cardName || null,
        cardType: e.cardType || null,
        name: e.name || null,
        card: e.card || null,
        success: e.success,
        nature: e.nature || null,
        target: { id: e.targetId },
        source: { id: e.sourceId },
        id: `${Date.now()}_${Math.random()}`,
      },
    });
    return;
  }

  if (msg.kind === 'prompt') {
    // 观战者永不接收/处理操作提示（防御：即使误发也不弹操作面板）
    if (online.spectator === true || online.role === 'spectator') return;
    const prompt = msg.prompt || {};
    const requestId = msg.requestId;
    const sendAction = (payload) => {
      net.relay(0, { kind: 'action', requestId, payload });
      set({ pendingAction: null });
    };

    let action = null;
    switch (prompt.type) {
      case 'play':
        action = {
          type: 'play',
          player: prompt.player,
          cards: prompt.cards || [],
          shaTargets: prompt.shaTargets || [],
          juedouTargets: prompt.juedouTargets || [],
          otherPlayers: prompt.otherPlayers || [],
          playableIds: prompt.playableIds || [],
          targetsByCard: prompt.targetsByCard || {},
          activeSkills: prompt.activeSkills || [],
          weaponActions: prompt.weaponActions || [],
          fangtianReady: !!prompt.fangtianReady,
          online: true,
          resolve: (value) => {
            if (!value || value.type === 'endPlay') {
              sendAction({ kind: 'endPlay' });
            } else if (value.type === 'useSkill') {
              sendAction({ kind: 'useSkill', skillId: value.skillId });
            } else if (value.type === 'useWeapon') {
              sendAction({ kind: 'useWeapon', weaponId: value.weapon });
            } else {
              // 方天画戟逐目标：允许多个 targetIds（房主端按序解析，最多 3 个）
              const targetIds = (value.targets || [])
                .map(t => t?.id)
                .filter(Boolean)
                .slice(0, 3);
              sendAction({
                kind: 'play',
                cardId: value.card?.id || null,
                targetIds,
              });
            }
          },
        };
        break;
      case 'discard':
        action = {
          type: 'discard',
          player: prompt.player,
          cards: prompt.cards || [],
          count: prompt.count || 0,
          online: true,
          resolve: (cards) => sendAction({
            kind: 'discard',
            cardIds: (cards || []).map(c => c.id),
          }),
        };
        break;
      case 'respond':
        action = {
          type: 'respond',
          player: prompt.player,
          cards: prompt.cards || [],
          online: true,
          resolve: (card) => sendAction({ kind: 'respond', cardId: card?.id || null }),
        };
        break;
      case 'confirm':
        action = {
          type: 'confirm',
          message: prompt.message || '是否发动？',
          online: true,
          resolve: (yes) => sendAction({ kind: 'confirm', yes: !!yes }),
        };
        break;
      case 'selectCards':
        action = {
          type: 'selectCards',
          player: prompt.player,
          cards: prompt.cards || [],
          min: prompt.min || 1,
          max: prompt.max || (prompt.cards || []).length,
          hint: prompt.hint || '',
          online: true,
          resolve: (cards) => sendAction({
            kind: 'selectCards',
            cardIds: (cards || []).map(c => c.id),
          }),
        };
        break;
      case 'chooseTarget':
        action = {
          type: 'chooseTarget',
          player: prompt.player,
          candidates: prompt.candidates || [],
          hint: prompt.hint || '',
          online: true,
          resolve: (target) => sendAction({ kind: 'chooseTarget', targetId: target?.id || null }),
        };
        break;
      default:
        return;
    }
    set({ pendingAction: action });
  }
}


/** 从 localStorage 读取已创建的武将/技能 */
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { characters: [], skills: [] };
    const data = JSON.parse(raw);
    return {
      characters: (data.characters || []).map(c => new Character(c)),
      skills: (data.skills || []).map(s => {
        const skill = new Skill(s);
        skill.applyCode();
        return skill;
      }),
    };
  } catch {
    return { characters: [], skills: [] };
  }
}

/** 持久化武将/技能到 localStorage */
function persist(characters, skills) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: '1.0',
      characters: characters.map(c => c.toJSON()),
      skills: skills.map(s => s.toJSON()),
    }));
  } catch {
    // localStorage 不可用时忽略
  }
}

const saved = loadSaved();

const useGameStore = create((set, get) => ({
  // 游戏实例
  game: null,
  gameState: null,

  // 数据注册表(用于UI展示)
  characters: saved.characters,   // 已创建的武将列表
  skills: saved.skills,           // 已创建的技能列表

  // UI状态
  selectedCard: null,
  selectedPlayer: null,
  logs: [],
  showOverlay: false,
  overlayContent: null,
  pendingAction: null, // 等待用户操作
  effect: null,        // 打击感反馈 { type, target, num, id }
  lastPlayerConfigs: null, // 上一局配置(用于重新开始)
  lastTeamMode: 'ffa',     // 上一局组队模式(用于重新开始)
  lastFriendlyFire: false, // 上一局误伤队友设置(用于重新开始)
  lastAutoTrigger: false,  // 上一局可选触发技自动发动设置(用于重新开始)

  // 联机状态
  online: defaultOnline(),

  // 本地聊天屏蔽名单（senderId/name；localStorage 持久化，仅本机生效）
  chatMuted: loadChatMuted(),

  // 初始化游戏（重置对局相关状态，保证重开干净）
  initGame: () => {
    runToken++;
    const oldGame = get().game;
    disposeGame(oldGame, get().pendingAction);
    const game = new Game();
    set({
      game,
      gameState: null,
      pendingAction: null,
      effect: null,
      logs: [],
    });
    return game;
  },

  // 开始游戏（options：teamMode 支持 ffa / 2v2 / 3v3；friendlyFire 仅组队生效）
  startGame: async (playerConfigs, seed = null, options = {}) => {
    const { characters, skills } = get();
    let game = get().game;
    if (!game) game = get().initGame();

    // 同一实例已开过局则重建，保证每次开局都是干净状态
    if (game.players.length > 0 || game.status !== 'idle') {
      disposeGame(game, get().pendingAction);
      game = get().initGame();
    }

    const token = ++runToken;
    const teamMode = normalizeTeamModeOption(options?.teamMode);
    const friendlyFire = normalizeFriendlyFireOption(teamMode, options?.friendlyFire);
    const autoTrigger = normalizeAutoTriggerOption(
      options?.autoTrigger !== undefined ? options.autoTrigger : readStoredAutoTrigger(),
    );

    // 牌堆种子：相同种子得到相同牌序
    game.config.seed = (seed === null || seed === undefined || seed === '') ? null : Number(seed);
    // 组队模式 / 误伤 / 自动触发写入引擎配置
    game.config.teamMode = teamMode;
    game.config.friendlyFire = friendlyFire;
    game.config.autoTrigger = autoTrigger;

    // 记录本局配置，供"再来一局"使用（保留每座位的 team 字段）
    set({
      lastPlayerConfigs: playerConfigs,
      lastTeamMode: teamMode,
      lastFriendlyFire: friendlyFire,
      lastAutoTrigger: autoTrigger,
      effect: null,
      pendingAction: null,
    });

    // 注册已有武将和技能
    characters.forEach(c => game.registerCharacter(c));
    skills.forEach(s => game.registerSkill(s));

    // 绑定状态/日志回调(必须在 init 之前绑定)；旧对局代次的回调直接丢弃
    game.ui.onStateChange = (state) => {
      if (token === runToken) set({ gameState: state });
    };
    game.onLog = (log) => {
      if (token === runToken) set(state => ({ logs: [...state.logs, log] }));
    };
    // 打击感反馈
    game.ui.onEffect = (e) => {
      if (token === runToken) {
        set({ effect: { ...e, id: `${Date.now()}_${Math.random()}` } });
      }
    };

    // 绑定UI交互回调（AI 行动带节奏停顿，回合不再一闪而过）
    game.ui.askForPlay = (player) => {
      if (player.isAI) {
        return aiPause(readAiDelay()).then(() => game.aiAutoPlay(player));
      }
      return new Promise((resolve) => {
        set({
          pendingAction: {
            type: 'play',
            player,
            resolve,
            activeSkills: game.getActiveSkills(player).map(s => ({
              id: s.id,
              name: s.name,
              description: s.description || '',
            })),
            shaTargets: game.getValidTargets(player, '杀'),
            juedouTargets: game.getValidTargets(player, '决斗'),
            otherPlayers: game.distance.getOtherAlivePlayers(player),
            weaponActions: game.getWeaponActions(player),
            playableIds: player.handCards
              .filter(c => game.canPlayCard(player, c))
              .map(c => c.id),
            targetsByCard: {
              杀: game.getValidTargets(player, '杀'),
              决斗: game.getValidTargets(player, '决斗'),
              顺手牵羊: game.getValidTargets(player, '顺手牵羊'),
              过河拆桥: game.getValidTargets(player, '过河拆桥'),
              乐不思蜀: game.getValidTargets(player, '乐不思蜀'),
              兵粮寸断: game.getValidTargets(player, '兵粮寸断'),
            },
          },
        });
      });
    };

    game.ui.askForDiscard = (player, count) => new Promise(async (resolve) => {
      if (player.isAI) {
        await aiPause(340);
        const sorted = [...player.handCards].sort((a, b) => (a.ai.order || 0) - (b.ai.order || 0));
        resolve(sorted.slice(0, count));
      } else {
        set({ pendingAction: { type: 'discard', player, count, resolve } });
      }
    });

    // 人类响应牌(闪/桃等)
    game.ui.askForCard = (player, filter) => new Promise(async (resolve) => {
      if (player.isAI) {
        await aiPause(340);
        const card = player.handCards.find(filter);
        resolve(card || null);
      } else {
        set({ pendingAction: { type: 'respond', player, filter, resolve } });
      }
    });

    // 装备栏已满：玩家必须选择一个旧装备槽替换（AI/无 window 直接第一项）
    game.ui.askForEquipReplace = (player, newCard, current, limit) => {
      const first = firstEquipSlot(current);
      if (player?.isAI || typeof window === 'undefined') return Promise.resolve(first);
      return new Promise((resolve) => {
        set({
          pendingAction: {
            type: 'equipReplace',
            player,
            newCard,
            cards: current,
            limit: Number(limit) || (Array.isArray(current) ? current.length : Object.keys(current || {}).length) || 3,
            resolve,
          },
        });
      });
    };

    // 主动技能：选择手牌（可多选）
    game.ui.askForCards = (player, opts = {}) => new Promise((resolve) => {
      const { min = 1, max = 1, filter = null, hint = '' } = opts;
      if (player.isAI) {
        resolve(game.aiPickSkillCards(player, { min, max, filter, hint }));
        return;
      }
      const cards = player.handCards.filter(filter || (() => true));
      set({
        pendingAction: {
          type: 'selectCards',
          player,
          cards,
          min,
          max: Math.min(max, cards.length),
          hint,
          resolve,
        },
      });
    });

    // 主动技能：选择目标
    game.ui.askForTarget = (player, candidates, hint = '') => new Promise((resolve) => {
      if (player.isAI) {
        resolve(game.aiPickSkillTarget(player, candidates, hint));
        return;
      }
      set({ pendingAction: { type: 'chooseTarget', player, candidates, hint, resolve } });
    });

    // 人类确认判定(技能发动/是否出桃)：走确认面板，非浏览器环境（脚本测试）自动同意避免挂起
    game.ui.askForConfirm = (message = '', player = null) => new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(true);
        return;
      }
      set({
        pendingAction: {
          type: 'confirm',
          player,
          message: message || '是否发动？',
          resolve,
        },
      });
    });

    set({ logs: [] });
    await game.init(playerConfigs);
    set({ gameState: game.getGameState() });

    // 主循环后台运行，避免阻塞 UI（"再来一局"可立即返回）
    game.run(0).catch((e) => {
      if (token !== runToken) return; // 已被新对局取代
      console.error('对局异常:', e);
      game.addLog(`对局异常: ${e.message || e}`);
      set({ gameState: game.getGameState(), pendingAction: null });
    });
  },

  /**
   * 投降：单机/房主直接结束对局；联机客户端向房主发送 surrender，由房主统一结算并广播。
   * @returns {boolean} 请求是否已发出/处理
   */
  surrenderGame: () => {
    const { game, online } = get();
    if (!game || game.status !== 'running') return false;
    if (online.active && !online.isHost) {
      if (!online.connected) return false;
      net.relay(0, { kind: 'surrender', seat: online.seat });
      set({ pendingAction: null });
      return true;
    }
    const seat = online.active ? (online.seat ?? 0) : 0;
    const player = game.players.find(p => p.seatNum === seat) || game.players[0];
    if (!player) return false;
    const pending = get().pendingAction;
    const ok = game.surrender(player);
    if (ok) {
      // 放行旧循环（联机远端 prompt 也一并结束等待）
      resolvePendingAction(pending);
      for (const req of hostRequests.values()) req.resolve(null);
      hostRequests.clear();
      set({ pendingAction: null });
    }
    return ok;
  },

  // 再来一局：沿用上一局配置、组队模式、误伤与自动触发设置，创建全新对局
  restartGame: async () => {
    const { lastPlayerConfigs, lastTeamMode, lastFriendlyFire, lastAutoTrigger, online } = get();
    if (online.active && online.isHost) {
      // 联机重开：沿用当前房间成员重新开局
      await get().hostStartOnline(online.playerCount || 2);
      return;
    }
    const configs = lastPlayerConfigs || [
      { name: '你', isAI: false, team: null },
      { name: 'AI2', isAI: true, team: null },
    ];
    get().initGame();
    await get().startGame(configs, null, {
      teamMode: lastTeamMode || 'ffa',
      friendlyFire: lastFriendlyFire === true,
      autoTrigger: lastAutoTrigger === true,
    });
  },

  // ============ 联机 ============

  // 初始化网络事件（只执行一次）
  initNet: () => {
    if (netInited) return;
    netInited = true;

    net.on('room', (msg) => {
      const prev = get().online;
      const role = msg.role === 'spectator' ? 'spectator' : 'player';
      const spectator = role === 'spectator';
      const roomChanged = !!prev.roomCode && prev.roomCode !== msg.code;
      const prevSpectators = (prev.members || []).filter(m => m.role === 'spectator').length;
      const nextMembers = msg.members || [];
      const nextSpectators = nextMembers.filter(m => m.role === 'spectator').length;
      set(state => ({
        online: {
          ...state.online,
          connected: true,
          connecting: false,
          error: null,
          roomCode: msg.code,
          seat: msg.seat ?? null,
          role,
          spectator,
          clientId: msg.id || (msg.role === 'player' && typeof msg.seat === 'number'
            ? `p${msg.seat}`
            : state.online.clientId),
          isHost: role === 'player' && msg.seat === 0,
          members: nextMembers,
          playerCount: msg.playerCount ?? state.online.playerCount,
          spectatorCount: msg.spectatorCount ?? nextSpectators,
          chatMessages: roomChanged ? [] : state.online.chatMessages,
          chatUnread: roomChanged ? 0 : state.online.chatUnread,
        },
      }));
      // 观战者中途加入：房主补发 start + 公共 state，避免观战端白屏
      try {
        const cur = get();
        if (cur.online.isHost && cur.online.active && cur.game && nextSpectators > prevSpectators) {
          const total = cur.online.playerCount || 2;
          net.relay('spectators', { kind: 'start', config: { playerCount: total }, spectate: true });
          net.relay('spectators', { kind: 'state', state: serializeState(cur.game, null) });
        }
      } catch {
        // 补发失败不影响房间状态
      }
    });

    net.on('error', (msg) => {
      set(state => ({
        online: { ...state.online, connecting: false, error: msg.message || '联机出错' },
      }));
    });

    net.on('notice', (msg) => {
      set(state => ({
        online: { ...state.online, notice: msg.message || '' },
      }));
    });

    net.on('lanip', (msg) => {
      set(state => ({
        online: { ...state.online, lanIps: msg.ips || [] },
      }));
    });

    net.on('closed', (msg) => {
      set(state => ({
        online: { ...defaultOnline(), error: msg.message || '房间已关闭' },
      }));
    });

    net.on('disconnect', () => {
      set(state => ({
        online: {
          ...state.online,
          connected: false,
          error: state.online.roomCode ? '与服务器断开连接' : state.online.error,
        },
      }));
    });

    net.on('relay', (msg) => handleNetRelay(msg, { set, get }));

    // 聊天消息：追加到历史；别人发的且未本地屏蔽才算未读
    net.on('chat', (msg) => {
      const message = msg && msg.message;
      if (!message || typeof message !== 'object' || !message.id || typeof message.text !== 'string') return;
      const state = get();
      const exists = (state.online.chatMessages || []).some(m => m.id === message.id);
      if (exists) return;
      const mine = !!state.online.clientId && message.senderId === state.online.clientId;
      const muted = state.isChatMuted(message);
      const nextMessages = [...(state.online.chatMessages || []), message].slice(-CHAT_HISTORY_LIMIT);
      set({
        online: {
          ...state.online,
          chatMessages: nextMessages,
          chatUnread: (mine || muted) ? state.online.chatUnread : (state.online.chatUnread || 0) + 1,
        },
      });
    });

    // 加入房间时的历史：合并去重，不计未读
    net.on('chatHistory', (msg) => {
      const incoming = Array.isArray(msg && msg.messages) ? msg.messages : [];
      const state = get();
      set({
        online: {
          ...state.online,
          chatMessages: mergeChatMessages(state.online.chatMessages, incoming),
        },
      });
    });
  },

  // 创建房间（自动连接服务器）
  onlineCreate: async ({ serverUrl, name }) => {
    get().initNet();
    const url = serverUrl || '';
    const nickname = name || '房主';
    set(state => ({
      online: { ...state.online, connecting: true, error: null, serverUrl: url, name: nickname },
    }));
    try {
      await net.connect(url);
    } catch (e) {
      set(state => ({ online: { ...state.online, connecting: false, error: e.message } }));
      return false;
    }
    net.createRoom(nickname);
    return true;
  },

  // 加入房间（spectate=true 以观战者身份加入，不占座位）
  onlineJoin: async ({ serverUrl, code, name, spectate = false }) => {
    get().initNet();
    const url = serverUrl || '';
    const nickname = name || (spectate ? '观战者' : '玩家');
    if (!code || !code.trim()) {
      set(state => ({ online: { ...state.online, error: '请输入房间号' } }));
      return false;
    }
    set(state => ({
      online: {
        ...state.online,
        connecting: true,
        error: null,
        serverUrl: url,
        name: nickname,
        role: spectate ? 'spectator' : 'player',
        spectator: spectate === true,
      },
    }));
    try {
      await net.connect(url);
    } catch (e) {
      set(state => ({ online: { ...state.online, connecting: false, error: e.message } }));
      return false;
    }
    net.joinRoom(code.trim().toUpperCase(), nickname, { spectate: spectate === true });
    return true;
  },

  // 离开联机(房间/对局)
  leaveOnline: () => {
    runToken++;
    disposeGame(get().game, get().pendingAction);
    hostRequests.clear();
    try { net.leave(); } catch { /* ignore */ }
    net.close();
    set({
      online: defaultOnline(),
      game: null,
      gameState: null,
      pendingAction: null,
      effect: null,
      logs: [],
    });
  },

  // ============ 联机聊天 ============

  /**
   * 发送聊天：未在房间/未连接/空白/超长时拒绝并设置 error。
   * 服务端还会做 trim/200 字截断/700ms 限流。
   * @returns {boolean} 是否已提交发送
   */
  sendChat: (text) => {
    const state = get();
    const online = state.online;
    if (!online.active || !online.connected || !online.roomCode) {
      set({ online: { ...online, error: '尚未加入联机房间' } });
      return false;
    }
    const normalized = normalizeChatText(text);
    if (!normalized) return false; // 空消息/纯空白：静默忽略
    net.sendChat(normalized);
    return true;
  },

  /** 清零聊天未读数 */
  markChatRead: () => {
    const online = get().online;
    if (!online.chatUnread) return;
    set({ online: { ...online, chatUnread: 0 } });
  },

  /**
   * 切换本地屏蔽（仅本机，持久化到 localStorage cgm_chat_muted，绝不上传）
   * @param {string|{senderId?:string,name?:string,id?:string}} target
   * @returns {boolean} 切换后是否为“已屏蔽”
   */
  toggleChatMute: (target) => {
    const entry = muteEntryOf(target);
    if (!entry) return false;
    const list = [...(get().chatMuted || [])];
    const idx = list.findIndex(item => muteEntryMatches(item, target));
    let muted;
    if (idx >= 0) {
      list.splice(idx, 1);
      muted = false;
    } else {
      list.push(entry);
      muted = true;
    }
    persistChatMuted(list);
    set({ chatMuted: list });
    return muted;
  },

  /** 判断消息/发送者是否被本地屏蔽（senderId 优先，其次 name） */
  isChatMuted: (target) => {
    return (get().chatMuted || []).some(entry => muteEntryMatches(entry, target));
  },

  /** 清空本地屏蔽名单 */
  clearChatMuted: () => {
    persistChatMuted([]);
    set({ chatMuted: [] });
  },

  /** 当前本地屏蔽名单（只读） */
  chatMuteList: () => get().chatMuted || [],

  // 房主：开始联机对局（客户端由中继消息驱动）
  hostStartOnline: async (playerCount = 2) => {
    const online = get().online;
    if (!online.isHost) return false;
    // 观战者不能开对局
    if (online.role === 'spectator' || online.spectator === true) return false;

    const { characters, skills } = get();
    let game = get().game;
    if (!game || game.players.length > 0 || game.status !== 'idle') {
      if (game) disposeGame(game, get().pendingAction);
      game = get().initGame();
    }

    const token = ++runToken;
    hostRequests = new Map();
    hostSeq = 0;

    // 只有「玩家」占座位；观战者不占人数、不生成 configs
    const members = [...(online.members || [])]
      .filter(m => m.role !== 'spectator' && typeof m.seat === 'number')
      .sort((a, b) => a.seat - b.seat);
    const spectators = (online.members || []).filter(m => m.role === 'spectator' || m.seat === null);
    const total = Math.min(6, Math.max(2, Number(playerCount) || 2, members.length));
    const configs = [];
    for (let seat = 0; seat < total; seat++) {
      const member = members.find(m => m.seat === seat);
      configs.push(member
        ? { name: member.name, isAI: false, seatNum: seat, team: null }
        : { name: `AI${seat + 1}`, isAI: true, seatNum: seat, team: null });
    }

    set({
      online: { ...online, active: true, playerCount: total },
      lastPlayerConfigs: configs,
      lastTeamMode: 'ffa',
      lastFriendlyFire: false,
      lastAutoTrigger: readStoredAutoTrigger(),
      gameState: null,
      pendingAction: null,
      effect: null,
      logs: [],
    });

    characters.forEach(c => game.registerCharacter(c));
    skills.forEach(s => game.registerSkill(s));

    // 联机每局生成新种子，牌序由种子决定；本轮联机不做组队入口，统一自由混战 + 禁止误伤
    game.config.seed = Math.floor(Math.random() * 900000) + 100000;
    game.config.teamMode = 'ffa';
    game.config.friendlyFire = false;
    // 联机房主设置页的「可选触发技自动发动」同样生效
    game.config.autoTrigger = readStoredAutoTrigger();

    const remoteSeats = members
      .filter(m => m.seat !== 0 && typeof m.seat === 'number')
      .map(m => m.seat);
    const hasSpectators = spectators.length > 0;

    const broadcastState = () => {
      for (const seat of remoteSeats) {
        net.relay(seat, { kind: 'state', state: serializeState(game, seat) });
      }
      // 观战者只收公共视图（seat=null，不含任何玩家手牌）
      if (hasSpectators) {
        net.relay('spectators', { kind: 'state', state: serializeState(game, null) });
      }
    };
    const broadcastEffect = (effect) => {
      const payload = serializeEffect(effect);
      for (const seat of remoteSeats) {
        net.relay(seat, { kind: 'effect', effect: payload });
      }
      if (hasSpectators) {
        net.relay('spectators', { kind: 'effect', effect: payload });
      }
    };

    // 房主本地状态与广播
    game.ui.onStateChange = (state) => {
      if (token !== runToken) return;
      set({ gameState: state });
      broadcastState();
    };
    game.onLog = (log) => {
      if (token !== runToken) return;
      set(state => ({ logs: [...state.logs, log] }));
    };
    game.ui.onEffect = (effect) => {
      if (token !== runToken) return;
      set({ effect: { ...effect, id: `${Date.now()}_${Math.random()}` } });
      broadcastEffect(effect);
    };

    // 向指定座位发提示并等待其操作；超时使用默认值
    const askRemote = (seat, prompt, parse) => new Promise((resolve) => {
      const requestId = `${Date.now()}_${++hostSeq}`;
      hostRequests.set(requestId, {
        resolve: (payload) => resolve(parse(payload)),
      });
      net.relay(seat, { kind: 'prompt', requestId, prompt });
      const timer = setTimeout(() => {
        if (hostRequests.has(requestId)) {
          hostRequests.delete(requestId);
          resolve(parse(null));
        }
      }, 60000);
      if (timer.unref) timer.unref();
    });

    // 出牌
    game.ui.askForPlay = (player) => {
      if (player.isAI) {
        return aiPause(readAiDelay()).then(() => game.aiAutoPlay(player));
      }
      if (player.seatNum === 0) {
        return new Promise((resolve) => {
          set({
            pendingAction: {
              type: 'play',
              player,
              resolve,
              online: true,
              activeSkills: game.getActiveSkills(player).map(s => ({
                id: s.id,
                name: s.name,
                description: s.description || '',
              })),
              shaTargets: game.getValidTargets(player, '杀'),
              juedouTargets: game.getValidTargets(player, '决斗'),
              otherPlayers: game.distance.getOtherAlivePlayers(player),
              weaponActions: game.getWeaponActions(player),
            },
          });
        });
      }
      return askRemote(player.seatNum, promptPlay(game, player, { includeSkills: true }), (payload) => {
        if (!payload || payload.kind === 'endPlay') return { type: 'endPlay' };
        if (payload.kind === 'useSkill') {
          const skill = (player.skills || []).find(s => s.id === payload.skillId);
          return skill ? { type: 'useSkill', skill } : { type: 'endPlay' };
        }
        if (payload.kind === 'useWeapon') {
          return { type: 'useWeapon', weapon: payload.weaponId };
        }
        const card = player.handCards.find(c => c.id === payload.cardId);
        if (!card) return { type: 'endPlay' };
        // 方天画戟可一次指定多个目标；兼容旧客户端只发 targetId
        const ids = Array.isArray(payload.targetIds) && payload.targetIds.length
          ? payload.targetIds
          : (payload.targetId ? [payload.targetId] : []);
        const targets = ids
          .map(id => game.players.find(p => p.id === id) || null)
          .filter(Boolean)
          .slice(0, 3);
        return { card, targets };
      });
    };

    // 弃牌
    game.ui.askForDiscard = (player, count) => new Promise(async (resolve) => {
      if (player.isAI) {
        await aiPause(340);
        const sorted = [...player.handCards].sort((a, b) => (a.ai.order || 0) - (b.ai.order || 0));
        return resolve(sorted.slice(0, count));
      }
      if (player.seatNum === 0) {
        set({ pendingAction: { type: 'discard', player, count, resolve, online: true } });
        return;
      }
      askRemote(player.seatNum, promptDiscard(player, count), (payload) => {
        if (!payload || payload.kind !== 'discard') return [];
        return (payload.cardIds || [])
          .map(id => player.handCards.find(c => c.id === id))
          .filter(Boolean)
          .slice(0, count);
      }).then(resolve);
    });

    // 响应牌（闪/桃/杀等）
    game.ui.askForCard = (player, filter) => new Promise(async (resolve) => {
      if (player.isAI) {
        await aiPause(340);
        return resolve(player.handCards.find(filter) || null);
      }
      if (player.seatNum === 0) {
        set({ pendingAction: { type: 'respond', player, filter, resolve, online: true } });
        return;
      }
      askRemote(player.seatNum, promptRespond(player, filter), (payload) => {
        if (!payload || payload.kind !== 'respond' || !payload.cardId) return null;
        // 只接受仍在手牌且满足响应条件的牌，防止客户端回执被伪造/过期
        return player.handCards.find(c => c.id === payload.cardId && filter(c)) || null;
      }).then(resolve);
    });

    // 装备栏替换（房主本人弹窗；远端/ AI 回退第一项，避免旧协议挂起）
    game.ui.askForEquipReplace = (player, newCard, current, limit) => {
      const first = firstEquipSlot(current);
      if (player?.isAI || typeof window === 'undefined') return Promise.resolve(first);
      if (player.seatNum === 0) {
        return new Promise((resolve) => {
          set({
            pendingAction: {
              type: 'equipReplace',
              player,
              newCard,
              cards: current,
              limit: Number(limit) || (Array.isArray(current) ? current.length : Object.keys(current || {}).length) || 3,
              resolve,
              online: true,
            },
          });
        });
      }
      return Promise.resolve(first);
    };

    // 主动技能：选择手牌/目标（房主本人面板；远端真人走提示，AI 自动）
    game.ui.askForCards = (player, opts = {}) => new Promise((resolve) => {
      const { min = 1, max = 1, filter = null, hint = '' } = opts;
      const pool = player.handCards.filter(filter || (() => true));
      if (player.isAI) {
        resolve(game.aiPickSkillCards(player, { min, max, filter, hint }));
        return;
      }
      if (player.seatNum === 0) {
        set({
          pendingAction: {
            type: 'selectCards',
            player,
            cards: pool,
            min,
            max: Math.min(max, pool.length),
            hint,
            resolve,
            online: true,
          },
        });
        return;
      }
      askRemote(player.seatNum, promptSelectCards(player, {
        cards: pool, min, max, hint,
      }), (payload) => {
        if (!payload || payload.kind !== 'selectCards') return [];
        const picked = (payload.cardIds || [])
          .map(id => pool.find(c => c.id === id))
          .filter(Boolean);
        return picked.slice(0, Math.min(max, pool.length));
      }).then(resolve);
    });

    game.ui.askForTarget = (player, candidates, hint = '') => new Promise((resolve) => {
      const list = candidates || [];
      if (player.isAI) {
        resolve(game.aiPickSkillTarget(player, list, hint));
        return;
      }
      if (player.seatNum === 0) {
        set({ pendingAction: { type: 'chooseTarget', player, candidates: list, hint, resolve, online: true } });
        return;
      }
      askRemote(player.seatNum, promptChooseTarget(player, list, hint), (payload) => {
        if (!payload || payload.kind !== 'chooseTarget' || !payload.targetId) return null;
        return list.find(p => p.id === payload.targetId) || null;
      }).then(resolve);
    });

    // 确认（技能发动/濒死求桃等）：AI 不打扰，远端真人只弹给其座位，房主本人走确认面板
    game.ui.askForConfirm = async (message = '', player = null) => {
      if (player?.isAI) return true;
      if (!player || player.seatNum === 0) {
        // 浏览器端用面板，脚本环境自动同意（避免无 UI 时挂起）
        if (typeof window === 'undefined') return true;
        return new Promise((resolve) => {
          set({
            pendingAction: {
              type: 'confirm',
              player,
              message: message || '是否发动？',
              online: true,
              resolve,
            },
          });
        });
      }
      return askRemote(player.seatNum, promptConfirm(message), (payload) => !!(payload && payload.yes));
    };

    // 通知所有客户端进入对局，然后初始化并发首帧状态
    for (const seat of remoteSeats) {
      net.relay(seat, { kind: 'start', config: { playerCount: total } });
    }
    if (hasSpectators) {
      // 观战者只收 public state，不参与对局；不会收到任何 prompt
      net.relay('spectators', { kind: 'start', config: { playerCount: total }, spectate: true });
    }

    await game.init(configs);
    set({ gameState: game.getGameState() });
    broadcastState();

    game.run(0).catch((e) => {
      if (token !== runToken) return;
      console.error('联机对局异常:', e);
      game.addLog(`对局异常: ${e.message || e}`);
      set({ gameState: game.getGameState(), pendingAction: null });
    });

    return true;
  },

  // 解决等待操作
  resolveAction: (result) => {
    const { pendingAction } = get();
    if (pendingAction?.resolve) {
      if (pendingAction.type === 'equipReplace') {
        const choices = normalizeEquipChoiceEntries(pendingAction.cards);
        const chosen = choices.some(entry => entry.slotKey === result)
          ? result
          : (choices[0]?.slotKey ?? null);
        pendingAction.resolve(chosen);
        set({ pendingAction: null });
        return;
      }
      pendingAction.resolve(result);
      set({ pendingAction: null });
    }
  },

  // 添加武将
  addCharacter: (charConfig) => {
    const character = new Character(charConfig);
    set(state => {
      const characters = [...state.characters, character];
      persist(characters, state.skills);
      return { characters };
    });
    return character;
  },

  // 更新武将
  updateCharacter: (id, updates) => {
    set(state => ({
      characters: state.characters.map(c => {
        if (c.id !== id) return c;
        Object.assign(c, updates);
        return c;
      }),
    }));
    const { characters, skills } = get();
    persist(characters, skills);
  },

  // 删除武将
  removeCharacter: (id) => {
    set(state => {
      const characters = state.characters.filter(c => c.id !== id);
      persist(characters, state.skills);
      return { characters };
    });
  },

  // 添加技能
  addSkill: (skillConfig) => {
    const skill = new Skill(skillConfig);
    set(state => {
      const skills = [...state.skills, skill];
      persist(state.characters, skills);
      return { skills };
    });
    return skill;
  },

  // 更新技能
  updateSkill: (id, updates) => {
    set(state => {
      const skills = state.skills.map(s => {
        if (s.id !== id) return s;
        Object.assign(s, updates);
        return s;
      });
      persist(state.characters, skills);
      return { skills };
    });
  },

  // 删除技能
  removeSkill: (id) => {
    set(state => {
      const skills = state.skills.filter(s => s.id !== id);
      persist(state.characters, skills);
      return { skills };
    });
  },

  // 从JSON恢复数据
  loadFromJSON: (data) => {
    const characters = (data.characters || []).map(c => new Character(c));
    const skills = (data.skills || []).map(s => {
      const skill = new Skill(s);
      skill.applyCode();
      return skill;
    });
    persist(characters, skills);
    set({ characters, skills });
  },

  // 导出为JSON
  exportToJSON: () => {
    const { characters, skills } = get();
    return {
      version: '1.0',
      characters: characters.map(c => c.toJSON()),
      skills: skills.map(s => s.toJSON()),
    };
  },

  // 设置选中卡牌
  setSelectedCard: (card) => set({ selectedCard: card }),
  setSelectedPlayer: (player) => set({ selectedPlayer: player }),
  setShowOverlay: (show, content = null) => set({ showOverlay: show, overlayContent: content }),
  clearLogs: () => set({ logs: [] }),
}));

export default useGameStore;

// 调试/诊断入口（不影响游戏逻辑）
if (typeof window !== 'undefined') {
  window.__cgmStore = useGameStore;
}
