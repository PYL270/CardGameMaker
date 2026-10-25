import React, { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import PlayerArea from './PlayerArea';
import HandZone, { cardKey } from './HandZone';
import { QuickPlayBar, AiThinkingBadge } from './QuickPlayBar';
import SkillText from '../ui/SkillText.jsx';
import Select from '../ui/Select';
import { firstEquipSlot } from './equipSlots';
import SelfCharacterCard from './SelfCharacterCard';
import ActionPanel from './ActionPanel';
import SpectatorPanel from './SpectatorPanel';
import ChatDock, { loadDanmakuEnabled, saveDanmakuEnabled, normalizeMutedIds } from './ChatDock';
import DanmakuLayer from './DanmakuLayer';
import LayoutSettings from './LayoutSettings';
import GameSettingsPanel from './GameSettingsPanel';
import CommandPalette from './CommandPalette';
import TacticalPulse from './TacticalPulse';
import {
  TEAM_MODE_OPTIONS,
  normalizeTeamMode,
  isTeamMode,
  teamModeLabel,
  teamPlayerCount,
  buildTeamConfigs,
  teamPreview,
  seatLabel,
  readDefaultTeamMode,
  readDefaultFriendlyFire,
  saveDefaultFriendlyFire,
  buildStartOptions,
  friendlyFireDisabled,
  readDefaultAutoTrigger,
  computeTeamOutcome,
  playerTeamOf,
} from './teamConfig';
import {
  loadLayout,
  saveLayout,
  normalizeLayout,
  applyPreset,
  updateLayout,
  defaultLayout,
  layoutData,
  layoutStyle,
  shouldOpenLog,
} from './layoutConfig';
import ResultOverlay from './ResultOverlay';
import CardGuide from './CardGuide';
import CardFace from './CardFace';
import InfoPanel from './InfoPanel';
import Icon from '../ui/Icon';
import Portrait from '../ui/Portrait';
import FxLayer from './FxOverlay';
import { TableCardStage, DiscardBurst } from './TableCardStage';
import { mapTableCardEffect, mapDiscardEffect, enqueueDiscard, shiftDiscard } from './tableStageFx';
import { mapEffectToFx, enqueueFx, shiftFx } from './effectFx';
import { PHASE_NAMES } from '../../core/Turn';
import { GROUP_NAMES } from '../../core/Character';
import { CLASSIC_CHARACTERS, CLASSIC_SKILLS } from '../../data/classicCharacters';
import { vibrate } from '../../utils/effects';
import { audio } from '../../audio/audioManager';
import usePanelDrag from '../../hooks/usePanelDrag';

const sameCard = (a, b) => (a?.id ?? '') === (b?.id ?? '');

/** 回合阶段轨道（与 core/Turn.js 的 PHASES 顺序一致） */
const PHASE_SEQUENCE = [
  { id: 'prepare', label: '准备' },
  { id: 'judge', label: '判定' },
  { id: 'draw', label: '摸牌' },
  { id: 'play', label: '出牌' },
  { id: 'discard', label: '弃牌' },
  { id: 'finish', label: '结束' },
];

const CARD_SFX_NAMES = { 杀: 'sha', 闪: 'shan', 桃: 'tao' };

function cardSfxName(cardName, cardType) {
  if (CARD_SFX_NAMES[cardName]) return CARD_SFX_NAMES[cardName];
  if (cardType === 'trick' || cardType === 'delay_trick') return 'trick';
  if (cardType === 'equip') return 'equip';
  return 'card';
}

function cardFxInfo(cardName, cardType) {
  if (cardName === '桃') return { kind: 'heal', label: '桃 · 回复' };
  if (cardName === '酒') return { kind: 'jiu', label: '酒 · 伤害+1' };
  if (cardName === '闪电') return { kind: 'thunder', label: '闪电 · 雷击' };
  if (cardName === '无懈可击') return { kind: 'shield', label: '无懈可击 · 抵消' };
  if (cardName === '杀') return null;
  if (cardType === 'equip') return { kind: 'equip', label: `${cardName || '装备'} · 装备` };
  if (cardType === 'trick' || cardType === 'delay_trick') return { kind: 'arcane', label: `${cardName} · 锦囊` };
  return null;
}

/** 手牌区提示文案（抽成纯函数便于 UI 测试；confirm 也用于濒死求桃等，不再写死“技能发动”） */
export function handHintFor(pendingAction) {
  if (!pendingAction) return '点击选牌 / 拖动摆放 / 双击复位；点右上角印或右键看说明';
  if (pendingAction.type === 'play') return '选择一张手牌确认出牌；点牌右上角印可看说明';
  if (pendingAction.type === 'discard') return `选择 ${pendingAction.count} 张牌弃置`;
  if (pendingAction.type === 'respond') return '选择可用的响应牌，或点「不使用」';
  if (pendingAction.type === 'confirm') return '请在上方确认（技能发动 / 使用桃等）';
  return '请在上方完成选择';
}

export default function GameBoard({ navigate, preview = null, initialLayout = null }) {
  // 预览/测试：SSR 下 zustand 只能读到 store 初始 state，preview 允许直接渲染指定对局视图
  const storeGameState = useGameStore(s => s.gameState);
  const storeGame = useGameStore(s => s.game);
  const storePendingAction = useGameStore(s => s.pendingAction);
  const storeEffect = useGameStore(s => s.effect);
  const storeLogs = useGameStore(s => s.logs);
  const storeOnline = useGameStore(s => s.online);
  const gameState = preview?.gameState ?? storeGameState;
  const game = preview?.game ?? storeGame;
  const pendingAction = preview?.pendingAction ?? storePendingAction;
  const effect = preview?.effect ?? storeEffect;
  const logs = preview?.logs ?? storeLogs;
  const online = preview?.online ?? storeOnline;
  const isSpectator = !!(online?.spectator || online?.role === 'spectator');
  const chatMessages = useGameStore(s => s.online.chatMessages);
  const chatUnread = useGameStore(s => s.online.chatUnread);
  const chatMuted = useGameStore(s => s.chatMuted || s.online.chatMuted);
  const chatClientId = useGameStore(s => s.online.clientId);
  const sendChat = useGameStore(s => s.sendChat);
  const toggleChatMute = useGameStore(s => s.toggleChatMute);
  const markChatRead = useGameStore(s => s.markChatRead);
  const resolveAction = useGameStore(s => s.resolveAction);
  const restartGame = useGameStore(s => s.restartGame);
  const surrenderGame = useGameStore(s => s.surrenderGame);
  const leaveOnline = useGameStore(s => s.leaveOnline);
  const characters = useGameStore(s => s.characters);
  const userSkills = useGameStore(s => s.skills);
  const startGame = useGameStore(s => s.startGame);

  // 布局设置：默认“名将杀式”，可从 localStorage 恢复；对局中即时生效并持久化
  const [layout, setLayout] = useState(() => (
    initialLayout ? normalizeLayout(initialLayout) : loadLayout()
  ));
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [shake, setShake] = useState(null);           // 'hard' | 'soft' | null
  const [flash, setFlash] = useState(false);          // 受击红色暗角
  const [damageInfo, setDamageInfo] = useState(null); // { playerId, num, id }
  const [restarting, setRestarting] = useState(false);
  const [showLog, setShowLog] = useState(() => shouldOpenLog(layout));
  const [showGuide, setShowGuide] = useState(false);
  const [banner, setBanner] = useState(null);
  const [feed, setFeed] = useState(null);
  const [flyCard, setFlyCard] = useState(null);
  const [slash, setSlash] = useState(null);
  const [drawInfo, setDrawInfo] = useState(null);
  const [autoPlay, setAutoPlay] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('cgm_auto_play') === '1';
    } catch {
      return false;
    }
  });
  const [recommendHint, setRecommendHint] = useState(null);
  const [recommendedKey, setRecommendedKey] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [danmakuEnabled, setDanmakuEnabled] = useState(() => loadDanmakuEnabled());
  const mutedChatIds = normalizeMutedIds(chatMuted);
  const unreadChat = Math.max(0, Number(chatUnread) || 0);
  const recommendingRef = useRef(false);
  const [infoPanel, setInfoPanel] = useState(null);
  const [cardFx, setCardFx] = useState(null);
  const [fxQueue, setFxQueue] = useState([]);          // 演出特效队列（处决/判定/回复/雷击）
  const [tableCard, setTableCard] = useState(null);    // 出牌桌面展示
  const [discardQueue, setDiscardQueue] = useState([]); // 弃牌飞散队列

  // 点击状态/技能/牌面类型印：在点击点附近弹出小说明面板
  const openInfo = (info, e) => {
    const rect = e?.currentTarget?.getBoundingClientRect?.();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const baseX = rect ? rect.right + 10 : vw / 2 - 130;
    const baseY = rect ? rect.top - 8 : vh / 2;
    setInfoPanel({
      ...info,
      x: Math.max(10, Math.min(baseX, vw - 300)),
      y: Math.max(64, Math.min(baseY, vh - 230)),
    });
  };
  const logRef = useRef(null);
  const selfDrag = usePanelDrag('selfzone');

  // 自动滚动日志
  useEffect(() => {
    if (showLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, showLog]);

  // 新的操作提示出现时清空选择
  useEffect(() => {
    setSelectedCards([]);
    setSelectedTarget(null);
    setRecommendHint(null);
  }, [pendingAction]);

  // 布局：任何修改立即持久化（键 cgm_layout），刷新后保留
  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  // 日志位置切到“隐藏”时收起
  useEffect(() => {
    if (layout.logPosition === 'hidden') setShowLog(false);
  }, [layout.logPosition]);

  // 对局结束后关闭投降确认框（联机结算/重开同样生效）
  useEffect(() => {
    if (gameState?.status !== 'running') setShowSurrenderConfirm(false);
  }, [gameState?.status]);

  // 战局指令台：Ctrl+K / Ctrl+/ 打开；输入框内单独按 / 不触发
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      const editable = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      );
      const withModifier = event.ctrlKey || event.metaKey;
      if (withModifier && (event.key === 'k' || event.key === 'K' || event.key === '/')) {
        event.preventDefault();
        setShowCommandPalette(v => !v);
      } else if (event.key === '/' && !editable && !withModifier && !event.altKey) {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const applyLayoutChange = (patch) => {
    setLayout(prev => updateLayout(prev, patch));
    if (patch.logCollapsed !== undefined) {
      setShowLog(!patch.logCollapsed && layout.logPosition !== 'hidden');
    }
  };
  const applyLayoutPreset = (preset) => {
    // 布局预设只切换布局，不覆盖玩家单独选择的界面风格
    const next = updateLayout(applyPreset(preset), { theme: layout.theme });
    setLayout(next);
    setShowLog(shouldOpenLog(next));
  };
  const resetLayoutAll = () => {
    const next = updateLayout(defaultLayout(), { theme: layout.theme });
    setLayout(next);
    setShowLog(shouldOpenLog(next));
    // 同时复位拖动面板（手牌区/操作面板/日志）的位置
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cgm:reset-layout'));
    }
  };

  // 新回合横幅（让每个玩家的出牌阶段都被看见）
  useEffect(() => {
    const cp = gameState?.currentPlayer;
    if (!gameState || gameState.status !== 'running' || !cp?.id) return;
    setBanner({ id: `${cp.id}_${gameState.round}`, name: cp.name, round: gameState.round });
    audio.playSfx('turn');
    const timer = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(timer);
  }, [gameState?.currentPlayer?.id, gameState?.round]);

  // 终局音效
  useEffect(() => {
    if (gameState?.status !== 'finished') return;
    const mySeat = online.active ? online.seat : 0;
    const me = gameState.players?.find(p => p.seatNum === mySeat);
    audio.playSfx(me?.status === 'alive' ? 'win' : 'lose');
  }, [gameState?.status]);

  // 打击感 / 运动感：出牌飞行、杀击闪光、摸牌提示、伤害反馈
  useEffect(() => {
    if (!effect) return;

    const mySeat = online.active ? online.seat : 0;
    const myPlayer = game?.players?.find(p => p.seatNum === mySeat)
      || gameState?.players?.find(p => p.seatNum === mySeat);
    const selfId = myPlayer?.id;
    const effectPlayerId = effect.player?.id || effect.playerId || null;
    const effectIsSelf = effectPlayerId === selfId;

    // 弃牌事件（引擎 task-32 后可能发 type:'discard'）：防御性读取，未知/空 cards 忽略
    const discardFx = mapDiscardEffect(effect);
    if (discardFx) {
      audio.playSfx('discard');
      setDiscardQueue(q => enqueueDiscard(q, discardFx));
    }

    // 演出特效管线：处决 / 濒死 / 判定 / 回复 / 雷击（引擎事件防御性读取）
    const fx = mapEffectToFx(effect);
    if (fx) {
      setFxQueue(q => enqueueFx(q, fx));
      if (fx.kind === 'execution') {
        audio.playSfx('kill');
        setShake('hard');
        vibrate([70, 40, 120]);
        const shakeTimer = setTimeout(() => setShake(null), 560);
        return () => clearTimeout(shakeTimer);
      }
      if (fx.kind === 'dying') {
        audio.playSfx('dying');
        vibrate([30, 60, 30]);
        return;
      }
      if (fx.kind === 'judge') {
        audio.playSfx('judge');
        return;
      }
      if (fx.kind === 'heal') {
        audio.playSfx('heal');
        return;
      }
      // 雷击：叠加全屏白闪 + 闪电，同时继续走下面的伤害反馈
    }

    if (effect.type === 'card') {
      const cardName = effect.card?.name || effect.cardName;
      const cardType = effect.card?.type || effect.cardType;
      audio.playSfx(cardSfxName(cardName, cardType));
      const playerName = effect.player?.name
        || gameState?.players?.find(p => p.id === effectPlayerId)?.name;
      if (playerName && cardName) {
        setFeed({ id: effect.id, text: `${playerName} 使用【${cardName}】` });
        setFlyCard({ id: effect.id, name: cardName, card: effect.card || null, self: effectIsSelf });
        const tableFx = mapTableCardEffect(effect);
        if (tableFx) setTableCard(tableFx);
        if (cardName === '杀') setSlash({ id: effect.id });
        const fx = cardFxInfo(cardName, cardType);
        if (fx) {
          setCardFx({ id: `fx-${effect.id}`, ...fx });
        }
        const timers = [
          setTimeout(() => setFeed(null), 1600),
          setTimeout(() => setFlyCard(null), 1500),
          setTimeout(() => setTableCard(null), 1500),
          setTimeout(() => setSlash(null), 460),
          setTimeout(() => setCardFx(null), 1000),
        ];
        return () => timers.forEach(clearTimeout);
      }
      return;
    }

    if (effect.type === 'weapon' || effect.type === 'armor' || effect.type === 'wuxie') {
      const name = effect.name || (effect.type === 'armor' ? '八卦阵' : '装备');
      const fx = effect.type === 'armor'
        ? { kind: 'shield', label: effect.success === false ? `${name} · 判定失败` : `${name} · 判定生效` }
        : effect.type === 'wuxie'
          ? { kind: 'shield', label: '无懈可击 · 锦囊抵消' }
          : { kind: name === '寒冰剑' ? 'ice' : name === '麒麟弓' ? 'gold' : 'weapon', label: `【${name}】发动` };
      setFeed({ id: effect.id, text: fx.label });
      setCardFx({ id: `fx-${effect.id}`, ...fx });
      const timer = setTimeout(() => { setFeed(null); setCardFx(null); }, 1500);
      return () => clearTimeout(timer);
    }

    if (effect.type === 'draw') {
      audio.playSfx('draw');
      setDrawInfo({ id: effect.id, num: effect.num || 0, self: effectIsSelf });
      const timer = setTimeout(() => setDrawInfo(null), 950);
      return () => clearTimeout(timer);
    }

    if (effect.type === 'damage-canceled') {
      audio.playSfx('click');
      return;
    }
    if (effect.type !== 'damage') return;

    const isSelf = effect.target?.id === selfId;
    setShake(isSelf ? 'hard' : 'soft');
    setFlash(isSelf);
    setDamageInfo({ playerId: effect.target?.id, num: effect.num, id: effect.id });
    audio.playSfx('damage');
    vibrate(isSelf ? [40, 50, 80] : [22, 30]);

    const t1 = setTimeout(() => setShake(null), 480);
    const t2 = setTimeout(() => setFlash(false), 540);
    const t3 = setTimeout(() => setDamageInfo(null), 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [effect?.id]);

  // 自动出牌：开启后按 AI 推荐自动完成本回合操作
  useEffect(() => {
    if (!autoPlay || !pendingAction) return;
    const timer = setTimeout(async () => {
      const pa = pendingAction;
      if (pa.type === 'play') {
        const rec = await computeRecommended(pa);
        if (useGameStore.getState().pendingAction !== pa) return;
        const result = isAutoActionUsable(pa, rec) ? rec : fallbackRecommendation(pa);
        if (!result) resolveAction({ type: 'endPlay' });
        else if (result.type === 'useSkill') resolveAction({ type: 'useSkill', skillId: result.skillId });
        else if (result.type === 'useWeapon') resolveAction({ type: 'useWeapon', weapon: result.weapon });
        else resolveAction({ card: result.card, targets: result.targets || [] });
      } else if (pa.type === 'discard') {
        const hand = pa.cards || pa.player?.handCards || [];
        const sorted = [...hand].sort((a, b) => (a.ai?.order || 0) - (b.ai?.order || 0));
        resolveAction(sorted.slice(0, pa.count || 0));
      } else if (pa.type === 'respond') {
        const cards = pa.cards || pa.player?.handCards || [];
        const card = pa.cards
          ? cards[0]
          : (typeof pa.filter === 'function' ? cards.find(pa.filter) : cards[0]);
        resolveAction(card || null);
      } else if (pa.type === 'selectCards') {
        const pool = pa.cards || [];
        const need = Math.max(pa.min || 1, 1);
        const sorted = [...pool].sort((a, b) =>
          (game?.aiDisposableScore?.(a) ?? 0) - (game?.aiDisposableScore?.(b) ?? 0));
        resolveAction(sorted.slice(0, need));
      } else if (pa.type === 'chooseTarget') {
        let pick = null;
        try {
          pick = game?.aiPickSkillTarget?.(pa.player, pa.candidates || [], pa.hint || '');
        } catch {
          // 联机客户端没有本地 Game 时回退到首个候选
        }
        resolveAction(pick || (pa.candidates || [])[0] || null);
      } else if (pa.type === 'equipReplace') {
        resolveAction(firstEquipSlot(pa.cards));
      } else if (pa.type === 'confirm') {
        resolveAction(true);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [autoPlay, pendingAction, game]);

  const handleRestart = async () => {
    if (restarting) return;
    if (online.active && !online.isHost) return; // 客户端等待房主重开
    setRestarting(true);
    setSelectedCards([]);
    setSelectedTarget(null);
    setShake(null);
    setFlash(false);
    setDamageInfo(null);
    try {
      await restartGame();
    } catch (e) {
      console.error('重新开始失败:', e);
    } finally {
      setRestarting(false);
    }
  };

  const handleExit = () => {
    if (gameState?.status === 'running' && !window.confirm('对局尚未结束，确定退出吗？')) return;
    if (online.active) leaveOnline();
    navigate('menu');
  };

  const confirmSurrender = () => {
    setShowSurrenderConfirm(false);
    surrenderGame?.();
  };

  // 联机客户端/观战者：等待房主同步首帧
  if (online.active && !gameState) {
    return (
      <div className="game-setup">
        <div className="panel waiting-panel">
          <h2>{isSpectator ? '等待观战同步…' : '正在同步对局…'}</h2>
          <p>{isSpectator ? '等待房主开始对局 / 正在同步公共牌桌' : '等待房主发送游戏状态'}</p>
          <button className="btn" onClick={handleExit}>{isSpectator ? '退出观战' : '离开房间'}</button>
        </div>
        <style>{`
          .game-setup { padding: 20px; height: 100%; display: flex; align-items: center; justify-content: center; }
          .waiting-panel { text-align: center; max-width: 360px; }
          .waiting-panel h2 { color: var(--accent-gold); margin-bottom: 10px; }
          .waiting-panel p { color: var(--text-secondary); margin-bottom: 18px; }
        `}</style>
      </div>
    );
  }

  // 观战者：房主尚未开局，不显示选将/操作
  if (isSpectator && (!gameState || gameState.status === 'idle')) {
    return (
      <div className="game-setup spectate-waiting">
        <div className="page-header">
          <button className="btn btn-small" onClick={handleExit}>← 退出观战</button>
          <h2>观战中</h2>
        </div>
        <div className="panel waiting-panel">
          <h2>等待房主开始对局</h2>
          <p>观战者不占座位，仅观看对局；房主开局后会自动同步公共牌桌。</p>
        </div>
      </div>
    );
  }

  // 未开局：选将
  if (!gameState || gameState.status === 'idle') {
    return (
      <div className="game-setup">
        <div className="page-header">
          <button className="btn btn-small" onClick={() => navigate('menu')}>← 返回</button>
          <h2>游戏设置</h2>
          <button className="btn btn-small" onClick={() => setShowGuide(true)}>卡牌说明</button>
        </div>
        <SetupPanel characters={characters} skills={userSkills} onStart={startGame} />
        {showGuide && <CardGuide onClose={() => setShowGuide(false)} />}
        <style>{`
          .game-setup { padding: 20px; overflow-y: auto; height: 100%; }
          .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
          .page-header h2 { color: var(--accent-gold); }
        `}</style>
      </div>
    );
  }

  const { players, currentPhase, currentPlayer } = gameState;
  const phaseIndex = PHASE_SEQUENCE.findIndex(p => p.id === currentPhase);
  const livePlayers = game?.players || [];
  const displayPlayers = livePlayers.length ? livePlayers : players || [];
  const mySeat = online.active && !isSpectator ? online.seat : 0;
  const selfPlayer = isSpectator ? null : (displayPlayers.find(p => p.seatNum === mySeat) || displayPlayers[0]);
  const otherPlayers = isSpectator ? displayPlayers : displayPlayers.filter(p => p.id !== selfPlayer?.id);
  // 组队模式：引擎 getGameState().teamMode 优先，联机旧快照/未合入时回退 ffa
  const teamMode = normalizeTeamMode(gameState?.teamMode || game?.config?.teamMode);
  const teamModeOn = isTeamMode(teamMode);
  // 误伤设置：优先 gameState（联机快照），离线回退 game.config；自由混战恒 false
  const friendlyFire = teamModeOn && !!(
    gameState?.friendlyFire !== undefined
      ? gameState.friendlyFire
      : game?.config?.friendlyFire
  );
  const teamOutcome = computeTeamOutcome(displayPlayers, mySeat, teamMode, selfPlayer);
  // 投降结算：投降者判负；组队模式队友投降则整队判负；其他玩家视为获胜
  const surrenderSeat = gameState?.surrenderSeat ?? game?.surrenderSeat ?? null;
  const hasSurrender = surrenderSeat !== null && surrenderSeat !== undefined;
  const surrenderer = hasSurrender
    ? displayPlayers.find(p => Number(p.seatNum) === Number(surrenderSeat))
    : null;
  const selfSurrendered = hasSurrender && Number(surrenderSeat) === Number(mySeat);
  const surrenderTeam = (hasSurrender && teamModeOn && surrenderer)
    ? playerTeamOf(surrenderer, teamMode)
    : null;
  const selfTeam = teamModeOn ? playerTeamOf({ seatNum: mySeat }, teamMode) : null;
  const surrenderLoss = hasSurrender && (
    selfSurrendered
    || (surrenderTeam !== null && selfTeam !== null && surrenderTeam === selfTeam)
  );
  const won = hasSurrender ? !surrenderLoss : teamOutcome.won;
  const resultSubtitle = hasSurrender
    ? (selfSurrendered
      ? '你已投降，本局结束'
      : (surrenderLoss
        ? '队友投降，本局结束'
        : `${surrenderer?.name || '对手'}投降，本局结束`))
    : teamOutcome.subtitle;
  const resultTitle = hasSurrender
    ? (selfSurrendered ? '已投降' : (surrenderLoss ? '队伍失败' : '对局结束'))
    : null;
  const canRestart = !isSpectator && (!online.active || online.isHost);
  const myHand = isSpectator ? [] : (selfPlayer?.handCards || []);
  const deck = gameState.deckInfo || {};
  const judgePlayers = displayPlayers.filter(p => (p.judgeCards || []).length > 0);

  const canSelectCard = (card) => {
    if (!pendingAction) return false;
    if (pendingAction.type === 'play') {
      if (Array.isArray(pendingAction.playableIds)) {
        return pendingAction.playableIds.includes(card.id);
      }
      return !!game?.canPlayCard(pendingAction.player, card);
    }
    if (pendingAction.type === 'discard') return true;
    if (pendingAction.type === 'selectCards') {
      return (pendingAction.cards || []).some(c => sameCard(c, card));
    }
    if (pendingAction.type === 'respond') {
      if (Array.isArray(pendingAction.cards)) {
        return pendingAction.cards.some(c => sameCard(c, card));
      }
      if (typeof pendingAction.filter === 'function') {
        return pendingAction.filter(card);
      }
      return true;
    }
    return false;
  };

  const toggleCard = (card) => {
    if (!pendingAction) return;
    audio.playSfx('click');
    if (pendingAction.type === 'play') {
      if (!canSelectCard(card)) {
        setRecommendHint('该牌现在不能主动使用：闪/无懈只能响应，桃需受伤，酒每回合一次');
        return;
      }
      setRecommendHint(null);
      setRecommendedKey('');
      setSelectedCards(selectedCards.some(c => sameCard(c, card)) ? [] : [card]);
    } else if (pendingAction.type === 'respond') {
      setSelectedCards([card]);
    } else if (pendingAction.type === 'discard' || pendingAction.type === 'selectCards') {
      const max = pendingAction.type === 'discard'
        ? (pendingAction.count || 0)
        : Math.min(pendingAction.max || 1, (pendingAction.cards || []).length);
      if (selectedCards.some(c => sameCard(c, card))) {
        setSelectedCards(selectedCards.filter(c => !sameCard(c, card)));
      } else if (selectedCards.length < max) {
        setSelectedCards([...selectedCards, card]);
      }
    }
  };

  // 推荐出牌：校验 AI 建议，无效则用本地兜底；最终结果直接反馈到面板
  const recommendHandOf = (pa) => pa?.player?.handCards || pa?.cards || [];

  const recommendValidTargets = (pa, cardName) => {
    if (pa?.targetsByCard?.[cardName]) return pa.targetsByCard[cardName];
    if (game?.getValidTargets) {
      try { return game.getValidTargets(pa.player, cardName) || []; } catch { return []; }
    }
    if (cardName === '杀') return pa.shaTargets || [];
    if (cardName === '决斗') return pa.juedouTargets || [];
    return pa.otherPlayers || [];
  };

  const recommendNeedsTarget = (cardName) => (
    ['杀', '决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'].includes(cardName)
  );

  const recommendCardInHand = (pa, card) => {
    if (!card) return false;
    return recommendHandOf(pa).some(c => {
      if (c.id && card.id) return c.id === card.id;
      return c.name === card.name && c.suit === card.suit && c.number === card.number;
    });
  };

  const isRecommendationValid = (pa, rec) => {
    if (!pa || pa.type !== 'play' || !rec || rec.type === 'endPlay') return false;
    if (!recommendCardInHand(pa, rec.card)) return false;
    if (['闪', '无懈可击'].includes(rec.card.name)) return false;
    if (Array.isArray(pa.playableIds) && rec.card?.id && !pa.playableIds.includes(rec.card.id)) {
      return false;
    }
    if (recommendNeedsTarget(rec.card.name)) {
      const valid = recommendValidTargets(pa, rec.card.name);
      if (!valid.length) return false;
      const target = rec.targets?.[0];
      if (!target) return false;
      const ok = valid.some(t => ((t.id && target.id) ? t.id === target.id : t.name === target.name));
      if (!ok) return false;
    }
    return true;
  };

  /**
   * 自动模式可执行的动作：卡牌、主动技、武器技。
   * aiAutoPlay 现在会返回 useSkill/useWeapon，不能再用只认卡牌的
   * isRecommendationValid 过滤，否则自动模式会把这些建议丢掉。
   */
  const isAutoActionUsable = (pa, rec) => {
    if (!pa || pa.type !== 'play' || !rec) return false;
    if (rec.type === 'useSkill') {
      return (pa.activeSkills || []).some(s => s.id === rec.skillId);
    }
    if (rec.type === 'useWeapon') {
      return (pa.weaponActions || []).some(w => w.id === rec.weapon);
    }
    return isRecommendationValid(pa, rec);
  };

  const fallbackRecommendation = (pa) => {
    const hand = recommendHandOf(pa);
    const playableIds = Array.isArray(pa.playableIds) ? pa.playableIds : null;
    const canUse = (card) => !playableIds || playableIds.includes(card.id);
    const find = (name) => hand.find(c => c.name === name && canUse(c));
    const player = pa.player || {};
    const make = (card, targets = []) => ({ card, targets });

    if (player.hp != null && player.maxHp != null && player.hp < player.maxHp) {
      const tao = find('桃');
      if (tao) return make(tao);
    }
    const sha = find('杀');
    if (sha) {
      const targets = recommendValidTargets(pa, '杀');
      if (targets.length) return make(sha, [targets[0]]);
    }
    const juedou = find('决斗');
    if (juedou) {
      const targets = recommendValidTargets(pa, '决斗');
      if (targets.length) return make(juedou, [targets[0]]);
    }
    const wzsy = find('无中生有');
    if (wzsy) return make(wzsy);
    for (const name of ['过河拆桥', '顺手牵羊', '乐不思蜀', '兵粮寸断']) {
      const card = find(name);
      if (!card) continue;
      const targets = recommendValidTargets(pa, name);
      if (targets.length) return make(card, [targets[0]]);
    }
    const equip = hand.find(c => c.type === 'equip' && canUse(c));
    if (equip) return make(equip);
    const aoe = hand.find(c => ['南蛮入侵', '万箭齐发', '桃园结义'].includes(c.name) && canUse(c));
    if (aoe) return make(aoe);
    return null;
  };

  const computeRecommended = async (pa) => {
    if (!pa || pa.type !== 'play') return null;
    // aiAutoPlay 是 async，必须 await，否则拿到的是 Promise
    if (game?.aiAutoPlay) return await game.aiAutoPlay(pa.player);
    const cards = pa.cards || [];
    const card = cards.find(c => c.name === '无中生有')
      || cards.find(c => c.name === '杀')
      || cards.find(c => c.name === '桃')
      || cards[0];
    if (!card) return { type: 'endPlay' };
    let targets = [];
    if (card.name === '杀') {
      targets = (pa.targetsByCard?.杀 || pa.shaTargets || []).slice(0, 1);
    } else if (['决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'].includes(card.name)) {
      targets = (pa.targetsByCard?.[card.name] || pa.juedouTargets || pa.otherPlayers || []).slice(0, 1);
    }
    return { card, targets };
  };

  // 推荐出牌：只选中 + 高亮推荐牌，绝不自动执行；由玩家点「确认出牌」
  const handleRecommend = async () => {
    const pa = pendingAction;
    if (!pa || pa.type !== 'play' || recommendingRef.current) return;
    recommendingRef.current = true;
    setRecommendHint('AI 正在思考…');
    try {
      const rec = await computeRecommended(pa);
      if (useGameStore.getState().pendingAction !== pa) return;
      const result = isRecommendationValid(pa, rec) ? rec : fallbackRecommendation(pa);
      if (!result) {
        setRecommendedKey('');
        setRecommendHint('无可出牌，可结束出牌');
        return;
      }
      const targetName = result.targets?.[0]?.name;
      setRecommendHint(`已推荐【${result.card.name}】${targetName ? ` → ${targetName}` : ''}；确认出牌或取消`);
      setSelectedCards([result.card]);
      setSelectedTarget(result.targets?.[0] || null);
      setRecommendedKey(cardKey(result.card));
    } catch (err) {
      console.error('[推荐出牌] 失败', err);
      setRecommendHint('推荐失败，请手动出牌');
    } finally {
      recommendingRef.current = false;
    }
  };

  const clearSelection = () => {
    setSelectedCards([]);
    setSelectedTarget(null);
    setRecommendHint(null);
    setRecommendedKey('');
  };

  const quickPlayCard = pendingAction?.type === 'play' ? (selectedCards[0] || null) : null;
  const quickPlayNeedsTarget = !!quickPlayCard
    && ['杀', '决斗', '顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'].includes(quickPlayCard.name);
  const quickPlayCanConfirm = !!quickPlayCard && (!quickPlayNeedsTarget || !!selectedTarget);

  const toggleAuto = () => {
    setAutoPlay(v => {
      const next = !v;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cgm_auto_play', next ? '1' : '0');
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  const confirmQuickPlay = () => {
    if (!quickPlayCanConfirm) return;
    resolveAction({
      card: quickPlayCard,
      targets: selectedTarget ? [selectedTarget] : [],
    });
    clearSelection();
  };

  // 一键整理：HandZone 内部按钮负责排序与动画，这里通过其按钮触发，避免复制排序逻辑
  const arrangeHand = () => {
    if (typeof document === 'undefined' || isSpectator) return;
    const button = document.querySelector('.self-zone .hand-sort-btn');
    if (button && typeof button.click === 'function') button.click();
  };

  const gameCommands = [
    {
      id: 'recommend', label: '推荐出牌', icon: 'sparkle', keywords: ['tuijian', 'tj', 'recommend'],
      hint: 'AI 推荐后由你确认，不自动出牌',
      disabled: pendingAction?.type !== 'play' || isSpectator,
      run: handleRecommend,
    },
    {
      id: 'confirm', label: '确认出牌', icon: 'check', keywords: ['queren', 'qr', 'confirm'],
      hint: '确认当前选中的牌与目标',
      disabled: !quickPlayCanConfirm || isSpectator,
      run: confirmQuickPlay,
    },
    {
      id: 'endPlay', label: '结束出牌', icon: 'check', keywords: ['jieshu', 'js', 'end'],
      hint: '结束当前出牌阶段',
      disabled: pendingAction?.type !== 'play' || isSpectator,
      run: () => resolveAction({ type: 'endPlay' }),
    },
    {
      id: 'arrange', label: '一键整理', icon: 'refresh', keywords: ['zhengli', 'zl', 'sort', 'arrange'],
      hint: '按当前手牌排序模式整理并播放动画',
      disabled: isSpectator || myHand.length === 0,
      run: arrangeHand,
    },
    {
      id: 'log', label: '查看日志', icon: 'log', keywords: ['rizhi', 'rz', 'log'],
      hint: '打开本局对局日志',
      disabled: layout.logPosition === 'hidden',
      run: () => setShowLog(true),
    },
    {
      id: 'guide', label: '卡牌说明', icon: 'book', keywords: ['shuoming', 'sm', 'guide', 'help'],
      hint: '查看卡牌与技能说明',
      run: () => setShowGuide(true),
    },
    {
      id: 'chat', label: '局内聊天', icon: 'chat', keywords: ['liaotian', 'lt', 'chat'],
      hint: '打开联机聊天面板',
      disabled: !online.active,
      run: () => {
        setChatOpen(true);
        markChatRead?.();
      },
    },
    {
      id: 'settings', label: '局内设置', icon: 'settings', keywords: ['shezhi', 'sz', 'settings'],
      hint: '音效 / AI 节奏 / 显示',
      run: () => setShowGameSettings(true),
    },
    {
      id: 'layout', label: '布局设置', icon: 'layout', keywords: ['buju', 'bj', 'layout'],
      hint: '预设 / 手牌缩放 / 日志位置',
      run: () => setShowLayoutSettings(true),
    },
    {
      id: 'exit', label: '退出对局', icon: 'exit', keywords: ['tuichu', 'tc', 'exit', 'quit'],
      hint: '离开当前牌桌',
      run: handleExit,
    },
  ];

  const handHint = handHintFor(pendingAction);

  return (
    <div
      className={`game-board ${isSpectator ? 'spectating' : ''} ${pendingAction && !isSpectator ? 'has-action' : ''} ${shake === 'hard' ? 'shake-hard' : shake === 'soft' ? 'shake-soft' : ''}`}
      {...layoutData(layout)}
      style={layoutStyle(layout)}>
      {selfPlayer?.usedJiu && <div className="jiu-ambience" aria-hidden="true" />}
      {selfPlayer?.hp <= 1 && selfPlayer?.status !== 'dead' && (
        <div className="low-hp-ambience" aria-hidden="true" />
      )}
      {flash && <div className="damage-flash" />}
      {layout.showBanner && banner && (
        <div className="turn-banner" key={banner.id}>
          <span className="turn-banner-name">{banner.name}</span>
          <span className="turn-banner-sub">第 {banner.round} 回合</span>
        </div>
      )}
      {layout.showFloats && feed && <div className="battle-feed" key={`feed-${feed.id}`}>{feed.text}</div>}
      {layout.showFloats && flyCard && (
        <div
          key={`fly-${flyCard.id}`}
          className={`fly-card game-card ${flyCard.card?.suit || ''} ${flyCard.card ? `card-type-${flyCard.card.type || 'basic'}` : ''} ${flyCard.self ? 'from-bottom' : 'from-top'}`}>
          {flyCard.card
            ? <CardFace card={flyCard.card} showBrief={false} />
            : <span className="fly-card-name">{flyCard.name}</span>}
          <span className="fly-glow" aria-hidden="true" />
        </div>
      )}
      {layout.showFloats && slash && <div key={`slash-${slash.id}`} className="slash-effect" />}
      {layout.showFloats && <TableCardStage fx={tableCard} />}
      {layout.showFloats && (
        <DiscardBurst
          fx={discardQueue[0] || null}
          onShift={() => setDiscardQueue(q => shiftDiscard(q))}
        />
      )}
      <FxLayer queue={fxQueue} onShift={() => setFxQueue(q => shiftFx(q))} />
      {layout.showFloats && cardFx && (
        <div key={cardFx.id} className={`card-fx fx-${cardFx.kind}`}>
          <span>{cardFx.label}</span>
        </div>
      )}
      <InfoPanel
        info={infoPanel}
        onClose={() => setInfoPanel(null)}
        onOpenGuide={() => setShowGuide(true)}
      />
      {layout.showFloats && drawInfo && (
        <div key={`draw-${drawInfo.id}`} className={`draw-pop ${drawInfo.self ? 'from-bottom' : 'from-top'}`}>
          摸牌 +{drawInfo.num}
        </div>
      )}

      {/* 顶部信息栏 */}
      <div className="board-header">
        <button className="btn btn-small header-action" onClick={handleExit}>
          <Icon name="exit" size={15} /><span className="btn-label">退出</span>
        </button>
        <span className="deck-info" title="牌堆剩余 / 总数">
          牌堆 {deck.remaining ?? 0}/{deck.total ?? 0}
        </span>
        {online.active && (
          <span className={`online-badge ${isSpectator ? 'spectator' : ''}`} title={`房间号 ${online.roomCode || ''}`}>
            {isSpectator ? '观战中' : (online.isHost ? '房主' : `座位${online.seat + 1}`)}
            {online.roomCode ? ` · ${online.roomCode}` : ''}
          </span>
        )}
        {teamModeOn && (
          <span className="team-mode-badge" title={`组队模式：${teamModeLabel(teamMode)}`}>
            {teamMode === '2v2' ? '2v2 组队' : '3v3 组队'}
          </span>
        )}
        {friendlyFire && (
          <span className="ff-badge" title="允许攻击队友（误伤）已开启：单体牌可指定队友为目标">
            误伤开启
          </span>
        )}
        <span className="phase-info">
          第{gameState.round}回合 · {PHASE_NAMES[currentPhase] || currentPhase || ''}
          {currentPlayer && ` · ${currentPlayer.name}的回合`}
        </span>
        <AiThinkingBadge visible={!!currentPlayer?.isAI && gameState.status === 'running'} name={currentPlayer?.name || ''} />
        {!isSpectator && (
          <button className={`btn btn-small header-action ${autoPlay ? 'btn-primary auto-on' : ''}`}
            title="自动出牌：按 AI 推荐完成操作"
            onClick={toggleAuto}>
            <Icon name={autoPlay ? 'pause' : 'auto'} size={15} />
            <span className="btn-label">{autoPlay ? '自动中' : '自动'}</span>
          </button>
        )}
        <button className="btn btn-small header-action" onClick={() => setShowGuide(true)}>
          <Icon name="book" size={15} /><span className="btn-label">说明</span>
        </button>
        {online.active && (
          <button
            className={`btn btn-small header-action chat-toggle ${chatOpen ? 'btn-primary' : ''}`}
            title="局内聊天"
            onClick={() => {
              setChatOpen(v => !v);
              if (!chatOpen) markChatRead?.();
            }}>
            <Icon name="chat" size={15} />
            <span className="btn-label">聊天</span>
            {unreadChat > 0 && (
              <span className="chat-unread-badge">{unreadChat > 99 ? '99+' : unreadChat}</span>
            )}
          </button>
        )}
        {layout.logPosition !== 'hidden' && (
          <button className="btn btn-small header-action" onClick={() => setShowLog(v => !v)}>
            <Icon name="log" size={15} />
            <span className="btn-label">{showLog ? '隐藏日志' : '日志'}</span>
          </button>
        )}
        <button className="btn btn-small header-action command-trigger"
          title="战局指令 Ctrl+K"
          onClick={() => setShowCommandPalette(true)}>
          <Icon name="search" size={15} /><span className="btn-label">指令</span>
        </button>
        <button className="btn btn-small header-action game-settings-trigger"
          title="局内设置：音效 / AI 节奏 / 显示"
          onClick={() => setShowGameSettings(true)}>
          <Icon name="settings" size={15} /><span className="btn-label">设置</span>
        </button>
        <button className="btn btn-small layout-trigger header-action"
          title="布局设置（预设 / 手牌缩放 / 日志位置 / 恢复默认）"
          onClick={() => setShowLayoutSettings(true)}>
          <Icon name="layout" size={15} /><span className="btn-label">布局</span>
        </button>
        {!isSpectator && gameState.status === 'running' && (
          <button className="btn btn-small header-action surrender-trigger"
            title="投降：立即结束本局并记为失败"
            onClick={() => setShowSurrenderConfirm(true)}>
            <Icon name="alert" size={15} /><span className="btn-label">投降</span>
          </button>
        )}
        {canRestart && (
          <button className="btn btn-small header-action" onClick={handleRestart} disabled={restarting}>
            <Icon name="refresh" size={15} /><span className="btn-label">重开</span>
          </button>
        )}
      </div>

      {/* 牌桌主区（其他玩家 + 中央提示） */}
      <div className="board-main">
        <div className={`other-players opponents-${Math.min(otherPlayers.length || 1, 6)}`}>
          {otherPlayers.map((p) => (
            <PlayerArea key={p.id} player={p} isCurrent={currentPlayer?.id === p.id}
              selectable={!isSpectator && pendingAction?.type === 'play'}
              hit={layout.showFloats && damageInfo?.playerId === p.id}
              damage={layout.showFloats && damageInfo?.playerId === p.id ? damageInfo : null}
              teamMode={teamMode}
              selfSeatNum={mySeat}
              showDistance={layout.showDistance}
              distanceMe={selfPlayer}
              distancePlayers={displayPlayers}
              onSelect={() => setSelectedTarget(p)}
              onInfo={openInfo} />
          ))}
        </div>

        <div className="board-center">
          {/* 中央牌桌：罗盘 + 回合核心（借鉴 OPEN 版桌面布局） */}
          <div className="table-hub" aria-hidden="true">
            <svg className="hub-rose" viewBox="0 0 400 400" fill="none">
              <circle cx="200" cy="200" r="196" stroke="currentColor" strokeWidth="0.7" />
              <circle cx="200" cy="200" r="164" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 11" />
              <circle cx="200" cy="200" r="124" stroke="currentColor" strokeWidth="0.6" />
              <circle cx="200" cy="200" r="86" stroke="currentColor" strokeWidth="0.4" />
              {Array.from({ length: 24 }, (_, i) => {
                const a = (i * Math.PI * 2) / 24;
                const r1 = i % 3 === 0 ? 124 : 144;
                return (
                  <line
                    key={i}
                    x1={200 + Math.cos(a) * r1}
                    y1={200 + Math.sin(a) * r1}
                    x2={200 + Math.cos(a) * 164}
                    y2={200 + Math.sin(a) * 164}
                    stroke="currentColor"
                    strokeWidth={i % 3 === 0 ? 0.9 : 0.4}
                  />
                );
              })}
              <path
                d="M200 74 L212 188 L326 200 L212 212 L200 326 L188 212 L74 200 L188 188 Z"
                stroke="currentColor"
                strokeWidth="0.7"
                opacity="0.85"
              />
            </svg>

            <div className="hub-core">
              <span className="hub-round">第 {gameState.round} 回合</span>
              <strong className="hub-name">{currentPlayer?.name || '对局进行中'}</strong>
              <span className="hub-phase">{PHASE_NAMES[currentPhase] || '等待开始'}</span>
            </div>
          </div>

          {/* 战局脉搏：中央罗盘下方的紧凑战术提示 */}
          <TacticalPulse
            selfPlayer={selfPlayer}
            players={displayPlayers}
            selectedTarget={selectedTarget}
            currentPlayer={currentPlayer}
            pendingAction={pendingAction}
            currentPhase={currentPhase}
            phaseLabel={PHASE_NAMES[currentPhase] || currentPhase || ''}
            spectator={isSpectator}
          />

          {/* 阶段轨道：整回合六段一目了然 */}
          <ol className="phase-track" aria-label="回合阶段">            {PHASE_SEQUENCE.map((p, i) => (
              <li
                key={p.id}
                className={`phase-node${i === phaseIndex ? ' is-current' : ''}${phaseIndex >= 0 && i < phaseIndex ? ' is-done' : ''}`}
                aria-current={i === phaseIndex ? 'step' : undefined}>
                <span className="phase-dot" />
                <span className="phase-label">{p.label}</span>
              </li>
            ))}
          </ol>

          <div className="table-stage">
            <div className="table-chips">
              <span className="chip">弃牌 {deck.discarded ?? 0}</span>
              <span className="chip">种子 {deck.seed ?? '-'}</span>
              {layout.preset !== 'classic' && (
                <span className="chip chip-phase">{PHASE_NAMES[currentPhase] || '对局中'}</span>
              )}
            </div>
            {/* 经典式保持原布局，不新增判定行；新预设增加“场面/判定展示” */}
            {layout.preset !== 'classic' && (
              <div className="stage-judges" title="判定区（延时锦囊）">
                {judgePlayers.length > 0
                  ? judgePlayers.map(p => (
                    <span key={p.id} className="stage-judge">
                      <b>{p.name}</b>
                      {(p.judgeCards || []).map(c => ` · 判·${c.name}`)}
                    </span>
                  ))
                  : <span className="stage-empty">判定区：无</span>}
              </div>
            )}
          </div>
          {pendingAction && !isSpectator ? (
            <ActionPanel action={pendingAction} onResolve={resolveAction}
              selectedCards={selectedCards} setSelectedCards={setSelectedCards}
              selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
              game={game} onRecommend={handleRecommend} recommendHint={recommendHint}
              distancePlayers={displayPlayers} showDistance={layout.showDistance}
              teamMode={teamMode} friendlyFire={friendlyFire}
              onInfo={openInfo} />
          ) : (
            <div className="turn-tip">
              {currentPlayer ? `${currentPlayer.name} 的回合 · ${PHASE_NAMES[currentPhase] || ''}` : '对局进行中'}
            </div>
          )}
        </div>
      </div>

      {/* 观战栏：只读公共信息，不渲染操作/手牌 */}
      {isSpectator && (
        <SpectatorPanel
          roomCode={online.roomCode || ''}
          playerCount={online.playerCount ?? displayPlayers.length}
          spectatorCount={online.spectatorCount ?? online.spectators?.length ?? 0}
          round={gameState.round}
          currentName={currentPlayer?.name || ''}
          phaseLabel={PHASE_NAMES[currentPhase] || currentPhase || ''}
          deck={deck}
          showLog={showLog}
          onToggleLog={() => setShowLog(v => !v)}
          onExit={handleExit}
          waiting={!gameState}
        />
      )}

      {online.active && (
        <DanmakuLayer
          messages={chatMessages || []}
          clientId={chatClientId || online.clientId || ''}
          mutedIds={mutedChatIds}
          enabled={danmakuEnabled}
        />
      )}
      {online.active && (
        <ChatDock
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          roomCode={online.roomCode || ''}
          messages={chatMessages || []}
          clientId={chatClientId || online.clientId || ''}
          mutedIds={mutedChatIds}
          onToggleMute={id => toggleChatMute?.(id)}
          onMarkRead={() => markChatRead?.()}
          onSend={typeof sendChat === 'function' ? text => sendChat(text) : undefined}
          connected={!!online.connected}
          spectator={isSpectator}
          danmakuEnabled={danmakuEnabled}
          onToggleDanmaku={next => {
            setDanmakuEnabled(next);
            saveDanmakuEnabled(next);
          }}
        />
      )}

      {/* 选中出牌条：固定悬浮在手牌上方，避免下滑确认 */}
      {!isSpectator && (
        <QuickPlayBar
        card={quickPlayCard}
        targetName={selectedTarget?.name || ''}
        canConfirm={quickPlayCanConfirm}
        onConfirm={confirmQuickPlay}
        onCancel={clearSelection}
      />
      )}

      {/* 底部：手牌 + 武将角色卡（三国杀式） */}
      {selfPlayer && (
        <div
          className={`self-zone ${selfDrag.dragging ? 'dragging-panel' : ''}`}
          style={{
            transform: `translate(${selfDrag.pos.x}px, ${selfDrag.pos.y}px)`,
            zIndex: selfDrag.dragging ? 1100 : 30,
          }}>
          <HandZone
            cards={myHand}
            selectedCards={selectedCards}
            recommendedKey={recommendedKey}
            canSelect={canSelectCard}
            dimDisabled={!!pendingAction}
            onToggleCard={toggleCard}
            hint={handHint}
            onInfo={openInfo}
          />
          <SelfCharacterCard
            player={selfPlayer}
            hit={layout.showFloats && damageInfo?.playerId === selfPlayer.id}
            damage={layout.showFloats && damageInfo?.playerId === selfPlayer.id ? damageInfo : null}
            teamMode={teamMode}
            showDistance={layout.showDistance}
            onInfo={openInfo}
            onPointerDown={selfDrag.onPointerDown}
            onDoubleClick={(e) => {
              if (!e.target.closest('button')) selfDrag.reset();
            }}
          />
        </div>
      )}

      {/* 悬浮日志：名将杀式默认收起为右侧竖排窄条，点击展开为抽屉 */}
      {!showLog && layout.logPosition !== 'hidden' && (
        <button className="log-strip" title="展开对局日志" onClick={() => setShowLog(true)}>
          日志
        </button>
      )}
      {showLog && layout.logPosition !== 'hidden' && (
        <div className={`log-panel panel log-panel-${layout.logPosition}`} ref={logRef}>
          <div className="log-title">
            <span>对局日志</span>
            <button className="btn btn-small log-collapse" onClick={() => setShowLog(false)}>
              <Icon name="chevron-down" size={13} className="is-open" />
              <span>收起</span>
            </button>
          </div>
          {logs.slice(-40).map((log, i) => (
            <div key={i} className="log-line">{log.message}</div>
          ))}
        </div>
      )}

      {/* 投降确认：游戏内弹层，避免 window.confirm 在手机/联机下阻断 */}
      {showSurrenderConfirm && (
        <div className="surrender-overlay" onClick={() => setShowSurrenderConfirm(false)}>
          <div className="panel surrender-dialog" role="dialog" aria-modal="true" aria-label="确认投降"
            onClick={(e) => e.stopPropagation()}>
            <div className="surrender-emblem" aria-hidden="true">降</div>
            <h3>确认投降？</h3>
            <p>
              投降后本局立即结束，并记为失败。
              {online.active ? '房间内所有玩家会同步看到结算。' : '你可以随后再来一局。'}
            </p>
            <div className="surrender-actions">
              <button className="btn" onClick={() => setShowSurrenderConfirm(false)}>继续对局</button>
              <button className="btn btn-danger" onClick={confirmSurrender}>确认投降</button>
            </div>
          </div>
        </div>
      )}

      {/* 终局结算 */}
      {gameState.status === 'finished' && (
        <ResultOverlay
          won={won}
          title={resultTitle}
          icon={hasSurrender ? '降' : null}
          round={gameState.round}
          subtitle={resultSubtitle}
          restarting={restarting}
          canRestart={canRestart}
          menuLabel={online.active ? '离开房间' : '返回主菜单'}
          onRestart={handleRestart}
          onMenu={() => {
            if (online.active) leaveOnline();
            navigate('menu');
          }}
        />
      )}

      {/* 战局指令台 Ctrl+K */}
      {showCommandPalette && (
        <CommandPalette
          open
          onClose={() => setShowCommandPalette(false)}
          commands={gameCommands}
          roomCode={online.roomCode || ''}
        />
      )}

      {/* 局内快捷设置（音效/AI 节奏/显示） */}
      {showGameSettings && (
        <GameSettingsPanel
          open
          onClose={() => setShowGameSettings(false)}
          layout={layout}
          onLayoutChange={applyLayoutChange}
          onOpenLayout={() => setShowLayoutSettings(true)}
          spectator={isSpectator}
          roomCode={online.roomCode || ''}
          modeLabel={teamModeLabel(teamMode)}
          round={gameState.round}
          phaseLabel={PHASE_NAMES[currentPhase] || currentPhase || ''}
        />
      )}

      {/* 详细说明 */}
      {showGuide && <CardGuide onClose={() => setShowGuide(false)} />}

      {/* 布局设置（齿轮打开；预设/缩放/日志位置/恢复默认） */}
      {showLayoutSettings && (
        <LayoutSettings
          layout={layout}
          onChange={applyLayoutChange}
          onPreset={applyLayoutPreset}
          onReset={resetLayoutAll}
          onClose={() => setShowLayoutSettings(false)}
        />
      )}

      <style>{`
        .game-board {
          width: 100%; height: 100%; display: flex; flex-direction: column;
          position: relative; overflow: hidden;
        }
        .turn-banner {
          position: absolute; top: 72px; left: 16px;
          z-index: 45; pointer-events: none;
          display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
          padding: 6px 14px;
          border-radius: 12px;
          background: rgba(8, 14, 28, 0.72);
          border: 1px solid rgba(247, 201, 72, 0.55);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px rgba(247, 201, 72, 0.18);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
          backdrop-filter: blur(14px) saturate(1.2);
          /* iOS 通知式：spring 下滑入场，停留后上滑淡出 */
          animation: bannerIn var(--dur-slow, 420ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both,
            bannerOut 0.45s var(--ease-ios, cubic-bezier(0.32, 0.72, 0, 1)) 1.25s forwards;
          overflow: hidden;
          will-change: transform, opacity;
        }
        .turn-banner::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.3) 48%, transparent 66%);
          transform: translateX(-130%);
          animation: bannerSweep 1.2s ease 0.12s;
        }
        @keyframes bannerSweep {
          to { transform: translateX(130%); }
        }
        .turn-banner-name {
          color: var(--accent-gold);
          font-family: var(--font-calligraphy);
          font-size: 17px;
          font-weight: 400;
          letter-spacing: 1px;
        }
        .turn-banner-sub { color: var(--text-secondary); font-size: 10px; letter-spacing: 1px; }
        @keyframes bannerIn {
          from { opacity: 0; transform: translateY(-18px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        @keyframes bannerOut {
          to { opacity: 0; transform: translateY(-14px) scale(0.98); }
        }
        .battle-feed {
          position: absolute; left: 16px; top: 136px;
          z-index: 44; pointer-events: none;
          max-width: 28vw;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-primary);
          background: linear-gradient(180deg, rgba(28, 31, 38, 0.92), rgba(9, 11, 16, 0.94));
          border: 1px solid rgba(214, 185, 110, 0.28);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          animation: feedIn 0.25s ease, feedOut 0.4s ease 1.1s forwards;
          white-space: normal;
          word-break: break-word;
        }
        @keyframes feedIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes feedOut {
          to { opacity: 0; transform: translateX(-8px); }
        }

        /* 出牌飞行 / 杀击闪光 / 摸牌提示 */
        .fly-card {
          position: fixed; left: 18%; top: 44%;
          width: 80px; height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 6px 5px 7px;
          pointer-events: none; z-index: 18;
          transform: translate(-50%, -50%);
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.65),
            0 0 30px rgba(214, 185, 110, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.85);
          will-change: transform, opacity, filter;
        }
        .fly-card .card-name { margin: 0; font-size: 14px; }
        .fly-card-name {
          position: relative;
          z-index: 2;
          font-family: var(--font-serif);
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 1px;
          color: var(--ink-text);
          margin-top: 42px;
        }
        .fly-glow {
          position: absolute;
          inset: -12px;
          border-radius: 20px;
          border: 1px solid rgba(240, 216, 148, 0.5);
          box-shadow: 0 0 32px rgba(240, 216, 148, 0.28), inset 0 0 18px rgba(240, 216, 148, 0.12);
          opacity: 0;
          pointer-events: none;
          z-index: 0;
          animation: flyGlow 1.45s ease-out 0.12s forwards;
        }
        @keyframes flyGlow {
          0% { opacity: 0; transform: scale(0.82); }
          34% { opacity: 0.7; transform: scale(1); }
          64% { opacity: 0.35; transform: scale(1.08); }
          100% { opacity: 0; transform: scale(1.22); }
        }
        .fly-card.from-bottom { animation: flyUp 1.45s cubic-bezier(0.16, 0.84, 0.26, 1) forwards; }
        .fly-card.from-top { animation: flyDown 1.45s cubic-bezier(0.16, 0.84, 0.26, 1) forwards; }
        @keyframes flyUp {
          0% { opacity: 0; transform: translate(-50%, 40vh) scale(0.62) rotate(-8deg); filter: blur(2px); }
          15% { opacity: 1; filter: blur(0); }
          42% { opacity: 1; transform: translate(-50%, -50%) scale(1.08) rotate(1.2deg); filter: blur(0); }
          54% { opacity: 1; transform: translate(-50%, -50.5%) scale(1.06) rotate(0.3deg); filter: blur(0); }
          66% { opacity: 1; transform: translate(-50%, -52%) scale(1.05) rotate(-0.3deg); filter: blur(0); }
          80% { opacity: 0.9; transform: translate(-50%, -52.5%) scale(1.02) rotate(0.2deg); filter: blur(0); }
          90% { opacity: 0.42; transform: translate(-50%, -53.5%) scale(0.99) rotate(-0.4deg); filter: blur(1px); }
          100% { opacity: 0; transform: translate(-50%, -56%) scale(0.9) rotate(-1.6deg); filter: blur(3px); }
        }
        @keyframes flyDown {
          0% { opacity: 0; transform: translate(-50%, -40vh) scale(0.62) rotate(8deg); filter: blur(2px); }
          15% { opacity: 1; filter: blur(0); }
          42% { opacity: 1; transform: translate(-50%, -50%) scale(1.08) rotate(-1.2deg); filter: blur(0); }
          54% { opacity: 1; transform: translate(-50%, -49.5%) scale(1.06) rotate(-0.3deg); filter: blur(0); }
          66% { opacity: 1; transform: translate(-50%, -48%) scale(1.05) rotate(0.3deg); filter: blur(0); }
          80% { opacity: 0.9; transform: translate(-50%, -47.5%) scale(1.02) rotate(-0.2deg); filter: blur(0); }
          90% { opacity: 0.42; transform: translate(-50%, -46.5%) scale(0.99) rotate(0.4deg); filter: blur(1px); }
          100% { opacity: 0; transform: translate(-50%, -44%) scale(0.9) rotate(1.6deg); filter: blur(3px); }
        }
        .slash-effect {
          position: fixed; inset: 0; pointer-events: none; z-index: 945;
          background: linear-gradient(112deg, transparent 44%, rgba(240, 216, 148, 0.7) 48%, rgba(255, 255, 255, 0.92) 50%, rgba(240, 216, 148, 0.6) 52%, transparent 57%);
          mix-blend-mode: screen;
          animation: slashSweep 0.42s ease-out forwards;
        }
        @keyframes slashSweep {
          0% { opacity: 0; transform: translateX(-26%) scaleX(0.6); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: translateX(26%) scaleX(1.15); }
        }
        .draw-pop {
          position: fixed; left: 50%; bottom: 26vh;
          transform: translateX(-50%);
          z-index: 930; pointer-events: none;
          font-size: 20px; font-weight: 800;
          color: var(--gold-bright);
          text-shadow: 0 0 18px rgba(214, 185, 110, 0.55);
          animation: drawPop 0.9s ease-out forwards;
        }
        .draw-pop.from-top { bottom: auto; top: 22vh; }
        @keyframes drawPop {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
          30% { opacity: 1; transform: translate(-50%, -6px) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -36px) scale(1); }
        }
        .hand-zone .game-card { animation: cardFadeIn 0.28s ease; }
        @keyframes cardFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .action-panel { animation: panelFade 0.22s ease; }
        @keyframes panelFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .board-header {
          position: relative;
          z-index: 30;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px; margin: 10px 12px 0;
          background: linear-gradient(160deg, rgba(24, 27, 34, 0.94), rgba(8, 10, 14, 0.96));
          border: 1px solid rgba(214, 185, 110, 0.28);
          border-radius: 14px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }
        .phase-info {
          color: var(--accent-gold);
          font-size: 13.5px;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .deck-info {
          font-size: 12px;
          color: var(--gold-bright);
          font-variant-numeric: tabular-nums;
          background: rgba(214, 185, 110, 0.08);
          border: 1px solid rgba(214, 185, 110, 0.22);
          border-radius: 8px;
          padding: 3px 9px;
          white-space: nowrap;
        }
        .online-badge {
          font-size: 11.5px; color: #9fe3c0;
          background: rgba(74, 222, 128, 0.12);
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 9px; padding: 3px 9px; white-space: nowrap;
        }

        .board-main {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          overflow-y: auto; overflow-x: hidden;
          padding: 10px 12px 4px; gap: 8px;
        }
        .other-players {
          position: relative;
          z-index: 30;
          display: flex; justify-content: center; align-items: flex-start;
          gap: 14px; flex-wrap: wrap; padding: 4px;
          flex-shrink: 0;
        }
        /* 对手卡尺寸：--opponent-scale 统一换算（默认 1 = 经典尺寸不变） */
        .other-players .player-area {
          min-width: calc(150px * var(--opponent-scale, 1));
          padding: calc(12px * var(--opponent-scale, 1));
        }
        .other-players .player-avatar {
          width: calc(44px * var(--opponent-scale, 1));
          height: calc(44px * var(--opponent-scale, 1));
          font-size: calc(19px * var(--opponent-scale, 1));
        }
        .other-players .player-name { font-size: calc(14px * var(--opponent-scale, 1)); }
        .other-players .char-name { font-size: calc(11px * var(--opponent-scale, 1)); }
        .other-players .hp-dot { font-size: calc(12px * var(--opponent-scale, 1)); }
        .board-center {
          position: relative;
          z-index: 30;
          flex: 1 0 auto; min-height: 120px;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 10px;
        }
        /* 中央场面 / 判定展示区 */
        .table-stage {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .table-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .chip {
          font-size: 12px; color: var(--text-secondary);
          background: linear-gradient(180deg, rgba(32, 36, 45, 0.9), rgba(12, 15, 21, 0.94));
          border: 1px solid rgba(214, 185, 110, 0.24);
          border-radius: 8px; padding: 3px 10px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 10px rgba(0, 0, 0, 0.35);
        }
        .chip-phase { color: var(--gold-bright); border-color: rgba(214, 185, 110, 0.4); }
        .stage-judges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; min-height: 18px; }
        .stage-judge {
          font-size: 11.5px; color: #d3b1ff;
          background: rgba(176, 107, 255, 0.1);
          border: 1px solid rgba(176, 107, 255, 0.26);
          border-radius: 8px; padding: 2px 9px;
        }
        .stage-judge b { color: var(--text-primary); font-weight: 700; }
        .stage-empty { font-size: 11px; color: rgba(255, 255, 255, 0.28); }
        .turn-tip {
          font-size: 14px; color: var(--text-secondary);
          padding: 10px 18px; border-radius: 12px;
          background: rgba(18, 21, 28, 0.55);
          border: 1px dashed rgba(214, 185, 110, 0.22);
        }

        /* ===== 中央牌桌：罗盘 + 回合核心 ===== */
        .table-hub {
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          width: 100%;
          display: grid;
          place-items: center;
          padding: 4px 0 2px;
        }
        .hub-rose {
          position: absolute;
          top: 50%;
          left: 50%;
          width: min(50vh, 430px);
          height: min(50vh, 430px);
          transform: translate(-50%, -50%);
          color: #d6b96e;
          opacity: 0.18;
          animation: hubSpin 150s linear infinite;
          pointer-events: none;
        }
        @keyframes hubSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        .hub-core {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          text-align: center;
        }
        .table-hub::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(46vh, 400px);
          aspect-ratio: 1;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle,
            rgba(6, 9, 14, 0.95) 28%, rgba(6, 9, 14, 0.55) 58%, transparent 73%);
        }
        .table-hub::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(38vh, 330px);
          aspect-ratio: 1;
          border-radius: 50%;
          pointer-events: none;
          border: 1px solid rgba(214, 185, 110, 0.16);
          animation: hubBreath 4.6s ease-in-out infinite;
        }
        @keyframes hubBreath { 0%, 100% { opacity: .3; } 50% { opacity: .9; } }
        .hub-round {
          font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
          font-size: 10px;
          letter-spacing: 3px;
          color: var(--text-secondary);
          opacity: 0.72;
        }
        .hub-name {
          font-family: var(--font-calligraphy);
          font-size: clamp(24px, 2.4vw, 34px);
          font-weight: 400;
          letter-spacing: 4px;
          line-height: 1.15;
          background: linear-gradient(104deg, #fdf5e2, #e2c583 54%, #b9954d);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hub-phase {
          margin-top: 1px;
          padding: 2px 13px;
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 2.5px;
          color: var(--gold-bright);
          border: 1px solid rgba(214, 185, 110, 0.32);
          background: rgba(214, 185, 110, 0.08);
        }

        /* ===== 阶段轨道：一个回合的六段 ===== */
        .phase-track {
          list-style: none;
          display: flex;
          align-items: center;
          gap: 2px;
          flex-wrap: wrap;
          justify-content: center;
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(214, 185, 110, 0.13);
          background: rgba(10, 13, 19, 0.66);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .phase-node {
          position: relative;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 1px;
          color: rgba(232, 226, 210, 0.4);
          transition: color .3s var(--ease-ios), background .3s var(--ease-ios);
        }
        .phase-node + .phase-node::before {
          content: '';
          position: absolute;
          left: -6px;
          top: 50%;
          width: 12px;
          height: 1px;
          background: rgba(214, 185, 110, 0.22);
        }
        .phase-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.6;
        }
        .phase-node.is-done { color: rgba(214, 185, 110, 0.56); }
        .phase-node.is-current { color: var(--gold-bright); background: rgba(214, 185, 110, 0.12); }
        .phase-node.is-current .phase-dot {
          opacity: 1;
          box-shadow: 0 0 9px currentColor;
          animation: phasePulse 1.9s ease-in-out infinite;
        }
        @keyframes phasePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.55); } }
        @media (min-width: 901px) { .chip-phase { display: none; } }
        @media (max-width: 900px) { .table-hub, .phase-track { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .hub-rose, .hub-core::after, .phase-node.is-current .phase-dot { animation: none !important; }
        }

        /* 底部手牌 + 武将 */
        .self-zone {
          display: flex; align-items: stretch; gap: 12px;
          padding: 6px 12px 10px;
          flex-shrink: 0;
          will-change: transform;
        }
        .hand-zone {
          flex: 1; min-width: 0;
          background: linear-gradient(160deg, rgba(23, 26, 33, 0.94), rgba(8, 10, 14, 0.96));
          border: 1px solid rgba(214, 185, 110, 0.26);
          border-radius: 14px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          padding: 8px 12px 10px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .hand-toolbar {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: nowrap;
          min-width: 0;
          font-size: 12px; color: var(--text-secondary);
        }
        .hand-title { color: var(--accent-gold); font-weight: 700; font-size: 13px; }
        .hand-count-badge {
          font-size: 11px; color: var(--gold-bright);
          background: rgba(214, 185, 110, 0.1);
          border: 1px solid rgba(214, 185, 110, 0.24);
          border-radius: 8px; padding: 1px 8px;
          font-variant-numeric: tabular-nums;
        }
        .hand-hint { flex: 1; min-width: 0; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hand-cards {
          display: flex; gap: var(--hand-gap, 8px); flex-wrap: nowrap; align-items: flex-end;
          justify-content: center;
          justify-content: safe center;
          min-height: calc(118px * var(--hand-scale, 1));
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 2px;
          perspective: 700px;
        }
        .hand-card-wrap { position: relative; margin-left: calc(var(--hand-overlap, 0px) + var(--hand-auto-overlap, 0px)); }
        .hand-cards .hand-card-wrap:first-child { margin-left: 0; }
        .hand-zone .hand-card-wrap:hover,
        .hand-zone .hand-card-wrap.selected-wrap { z-index: 45 !important; }
        .hand-zone .game-card {
          width: calc(82px * var(--hand-scale, 1));
          height: calc(120px * var(--hand-scale, 1));
          transition:
            transform 260ms var(--ease-ios, cubic-bezier(0.32, 0.72, 0, 1)),
            translate 280ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
            scale 280ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
            box-shadow 280ms var(--ease-ios, cubic-bezier(0.32, 0.72, 0, 1)),
            border-color 260ms var(--ease-ios, cubic-bezier(0.32, 0.72, 0, 1));
        }
        .hand-zone .game-card:hover {
          --card-lift: -6px;
          border-color: rgba(120, 92, 48, 0.72);
          box-shadow:
            0 1px 1px rgba(0, 0, 0, 0.3),
            0 12px 24px rgba(0, 0, 0, 0.28),
            0 26px 46px rgba(0, 0, 0, 0.2);
        }
        .hand-zone .game-card.dragging-card {
          transition: none;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(214, 185, 110, 0.45);
        }
        .hand-zone.hand-shining .game-card,
        .hand-zone.hand-shining .hand-card-wrap { transition: none; }
        .hand-zone .card-brief {
          font-size: 9.5px;
          line-height: 1.32;
          color: rgba(52, 42, 26, 0.78);
          max-width: 78px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }
        .hand-zone .card-name {
          font-size: 13px;
          font-weight: 800;
          color: #2c2416;
        }
        .disabled-card { opacity: 0.76; filter: saturate(0.62) brightness(0.96); }
        .selectable-card { cursor: pointer; }
        .self-character {
          width: 230px; flex-shrink: 0;
          position: relative;
          background:
            linear-gradient(160deg, rgba(26, 29, 36, 0.95), rgba(9, 11, 16, 0.96)) padding-box,
            linear-gradient(150deg, rgba(214, 185, 110, 0.5), rgba(255, 255, 255, 0.04) 40%, rgba(214, 185, 110, 0.18)) border-box;
          border: 1px solid transparent;
          border-radius: 14px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          padding: 10px 12px;
          display: flex; flex-direction: column; gap: 6px;
          cursor: grab; user-select: none; touch-action: none;
        }
        .self-character.hit { animation: hitFlash 0.45s ease-out; }
        .self-character.jiu {
          border-color: rgba(208, 87, 79, 0.7) !important;
          box-shadow: 0 0 0 1px rgba(208, 87, 79, 0.35), 0 0 28px rgba(208, 87, 79, 0.28),
            0 16px 36px rgba(0, 0, 0, 0.55);
        }
        .self-character.dying {
          border-color: rgba(255, 70, 60, 0.9) !important;
          animation: dyingPulse 1.2s ease-in-out infinite;
        }
        .self-char-head { display: flex; gap: 10px; align-items: center; }
        .self-avatar {
          width: 46px; height: 46px; border-radius: 50%;
          border: 2px solid; display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800;
          background:
            radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.12), transparent 60%),
            linear-gradient(160deg, #1c2028, #0a0c11);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 10px rgba(0, 0, 0, 0.5);
          flex-shrink: 0;
        }
        .self-char-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .self-name { font-size: 14px; font-weight: 700; }
        .self-char-name { font-size: 11px; color: var(--text-secondary); }
        .self-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
        .self-tags-label { font-size: 10px; color: var(--text-secondary); }
        .turn-tip, .hand-zone, .self-character { -webkit-user-select: none; user-select: none; }

        /* 悬浮日志：右侧抽屉 / 底部抽屉 / 收起窄条 */
        .log-panel {
          position: absolute; right: 14px; top: 86px;
          width: 250px; max-height: 30vh; overflow-y: auto;
          z-index: 35;
          padding: 10px 12px;
          border-radius: 14px;
          font-size: 11.5px;
          color: var(--text-secondary);
        }
        .log-panel-right { right: 14px; top: 86px; left: auto; bottom: auto; width: 250px; max-height: 34vh; }
        /* 底部抽屉抬到“自己手牌区”上方，避免遮挡手牌与操作 */
        .log-panel-bottom { left: 14px; right: 14px; top: auto; bottom: 190px; width: auto; max-height: 20vh; z-index: 25; }
        .log-title {
          color: var(--accent-gold); font-size: 12px; margin-bottom: 6px; font-weight: 700;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .log-collapse { min-height: 24px; padding: 1px 9px; font-size: 11px; }
        .log-strip {
          position: absolute; right: 8px; top: 50%;
          transform: translateY(-50%);
          z-index: 36;
          writing-mode: vertical-rl;
          letter-spacing: 3px;
          padding: 12px 5px;
          font-size: 12px;
          color: var(--accent-gold);
          background: linear-gradient(180deg, rgba(28, 31, 38, 0.94), rgba(9, 11, 16, 0.95));
          border: 1px solid rgba(214, 185, 110, 0.3);
          border-radius: 10px;
          cursor: pointer;
        }
        .log-strip:hover { border-color: rgba(214, 185, 110, 0.7); color: var(--gold-bright); }
        .log-panel .log-line { padding: 2px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .log-panel .log-line:last-child { color: var(--text-primary); }

        /* 技能按钮呼吸光 / 自动模式脉冲 */
        .skill-actions .btn {
          animation: skillBreath 3.2s ease-in-out infinite;
        }
        @keyframes skillBreath {
          0%, 100% { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 rgba(214, 185, 110, 0); }
          50% { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 16px rgba(214, 185, 110, 0.28); }
        }
        .auto-on { animation: autoPulse 1.6s ease-in-out infinite; }
        @keyframes autoPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(214, 185, 110, 0.0); }
          50% { box-shadow: 0 0 16px rgba(214, 185, 110, 0.32); }
        }

        /* ===== 布局预设：名将杀式（默认） ===== */
        .game-board[data-layout="mingsha"] .board-header {
          padding: 4px 10px; margin: 6px 8px 0; gap: 6px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(22, 25, 32, 0.96), rgba(8, 10, 14, 0.97));
        }
        .game-board[data-layout="mingsha"] .board-header .btn-small {
          min-height: 26px; padding: 3px 9px; font-size: 12px;
        }
        .game-board[data-layout="mingsha"] .phase-info { font-size: 12px; }
        .game-board[data-layout="mingsha"] .board-main {
          padding: 6px 8px 2px; gap: 6px;
        }
        .game-board[data-layout="mingsha"] .other-players {
          flex-wrap: nowrap; overflow-x: auto; justify-content: center;
          gap: 8px; padding: 2px 2px 4px;
        }
        .game-board[data-layout="mingsha"] .other-players .player-area {
          width: calc(150px * var(--opponent-scale, 1));
          min-width: calc(118px * var(--opponent-scale, 1));
        }
        .game-board[data-layout="mingsha"] .other-players .player-area.current {
          border-color: rgba(247, 201, 72, 0.95);
          animation: layoutGoldBreath 2.2s ease-in-out infinite;
        }
        @keyframes layoutGoldBreath {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(247, 201, 72, 0.35), 0 0 14px rgba(247, 201, 72, 0.16),
              0 12px 26px rgba(0, 0, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 0 2px rgba(247, 201, 72, 0.6), 0 0 26px rgba(247, 201, 72, 0.35),
              0 12px 26px rgba(0, 0, 0, 0.5);
          }
        }
        .game-board[data-layout="mingsha"] .board-center {
          justify-content: flex-end; padding-bottom: 2px;
        }
        .game-board[data-layout="mingsha"] .table-stage { gap: 4px; }
        .game-board[data-layout="mingsha"] .turn-tip { padding: 6px 14px; font-size: 12.5px; }
        .game-board[data-layout="mingsha"] .self-zone {
          flex-direction: row-reverse; /* 自己武将卡固定在左下，手牌区在右侧 */
          align-items: flex-end; gap: 10px;
          padding: 2px 10px calc(10px + env(safe-area-inset-bottom));
        }
        /* 人数多时自动缩小对手卡而不是换行溢出 */
        .game-board[data-layout="mingsha"] .other-players.opponents-5 .player-area,
        .game-board[data-layout="mingsha"] .other-players.opponents-6 .player-area,
        .game-board[data-layout="compact"] .other-players.opponents-5 .player-area,
        .game-board[data-layout="compact"] .other-players.opponents-6 .player-area {
          min-width: calc(104px * var(--opponent-scale, 1));
          padding: calc(8px * var(--opponent-scale, 1));
        }
        .game-board[data-layout="mingsha"] .other-players.opponents-5 .player-avatar,
        .game-board[data-layout="mingsha"] .other-players.opponents-6 .player-avatar,
        .game-board[data-layout="compact"] .other-players.opponents-5 .player-avatar,
        .game-board[data-layout="compact"] .other-players.opponents-6 .player-avatar {
          width: calc(34px * var(--opponent-scale, 1));
          height: calc(34px * var(--opponent-scale, 1));
          font-size: calc(15px * var(--opponent-scale, 1));
        }
        .game-board[data-layout="mingsha"] .self-character {
          width: 210px; align-self: flex-end;
          background:
            linear-gradient(160deg, rgba(24, 27, 34, 0.96), rgba(8, 10, 15, 0.97)) padding-box,
            linear-gradient(150deg, rgba(247, 201, 72, 0.55), rgba(255, 255, 255, 0.04) 45%, rgba(247, 201, 72, 0.2)) border-box;
        }
        .game-board[data-layout="mingsha"] .hand-zone {
          border-radius: 16px;
          background: linear-gradient(160deg, rgba(21, 24, 31, 0.95), rgba(8, 10, 14, 0.97));
        }
        .game-board[data-layout="mingsha"] .log-panel-right {
          top: 48px; right: 8px; width: 238px; max-height: 30vh;
        }
        .game-board[data-layout="mingsha"] .log-panel-bottom {
          bottom: 188px; left: 8px; right: 8px; max-height: 18vh;
        }
        .game-board[data-layout="mingsha"] .log-strip { right: 6px; top: 46%; }

        /* ===== 布局预设：紧凑式 ===== */
        .game-board[data-layout="compact"] .board-header {
          padding: 3px 8px; margin: 4px 6px 0; gap: 4px; border-radius: 8px;
        }
        .game-board[data-layout="compact"] .board-header .btn-small {
          min-height: 24px; padding: 2px 7px; font-size: 11.5px;
        }
        .game-board[data-layout="compact"] .phase-info { font-size: 11px; }
        .game-board[data-layout="compact"] .board-main { padding: 4px 6px 0; gap: 4px; }
        .game-board[data-layout="compact"] .other-players { flex-wrap: wrap; gap: 6px; }
        .game-board[data-layout="compact"] .board-center { min-height: 60px; }
        .game-board[data-layout="compact"] .self-zone {
          padding: 2px 6px calc(8px + env(safe-area-inset-bottom)); gap: 6px;
        }
        .game-board[data-layout="compact"] .self-character { width: 172px; }
        .game-board[data-layout="compact"] .hand-zone { padding: 6px 8px; }
        .game-board[data-layout="compact"] .hand-hint { display: none; }

        @media (max-width: 1000px), (max-height: 760px) {
          .hand-zone .game-card {
            width: calc(64px * var(--hand-scale, 1));
            height: calc(94px * var(--hand-scale, 1));
          }
          .hand-cards { min-height: calc(92px * var(--hand-scale, 1)); }
          .self-character { width: 190px; padding: 8px 10px; }
          .self-avatar { width: 38px; height: 38px; font-size: 16px; }
          .log-panel { width: 210px; max-height: 28vh; }
        }
        @media (max-width: 720px) {
          .board-header {
            margin: 6px 6px 0; padding: 6px 8px; gap: 6px;
            flex-wrap: wrap; border-radius: 12px;
          }
          .phase-info { font-size: 11.5px; flex: 1 1 100%; order: 10; }
          .online-badge { font-size: 10px; padding: 2px 7px; }
          .board-main { padding: 6px; gap: 6px; }
          .other-players {
            gap: 8px; flex-wrap: nowrap; overflow-x: auto;
            justify-content: flex-start; padding: 2px;
          }
          .other-players .player-area {
            min-width: calc(118px * var(--opponent-scale, 1));
            padding: calc(8px * var(--opponent-scale, 1));
          }
          .board-center { min-height: 70px; }
          .table-chips .chip { font-size: 10.5px; padding: 2px 8px; }
          .turn-banner-name { font-size: 14px; }
          .turn-banner, .battle-feed { display: none; }
          .fly-card {
            left: 72%; top: 32%;
            width: 54px; height: 82px;
            padding: 3px;
          }
          .fly-card .card-name { font-size: 11px; }
          .fly-card .card-brief { display: none; }
          .fly-card .card-watermark { font-size: 28px; }
          .fly-card .card-seal { font-size: 7px; padding: 0 2px; }
          .self-zone {
            flex-direction: column-reverse; padding: 4px 6px calc(8px + env(safe-area-inset-bottom));
            gap: 6px;
          }
          .hand-zone { padding: 6px 8px 8px; border-radius: 14px; }
          .hand-toolbar { font-size: 10.5px; gap: 6px; }
          .hand-title { font-size: 11.5px; }
          .hand-hint { display: none; }
          .hand-cards {
            gap: min(6px, var(--hand-gap, 6px));
            max-height: 172px; overflow-y: auto; min-height: 0;
            align-items: flex-start;
          }
          .hand-zone .game-card {
            width: calc(56px * var(--hand-scale, 1));
            height: calc(84px * var(--hand-scale, 1));
            border-radius: 9px;
          }
          .hand-zone .card-brief { font-size: 7.5px; max-width: 50px; }
          .hand-zone .card-name { font-size: 10px; }
          .self-character {
            width: 100%; flex-direction: row; flex-wrap: wrap;
            align-items: center; padding: 8px 10px; border-radius: 14px;
          }
          .self-char-head { flex: 1 1 auto; }
          .self-tags { flex: 1 1 100%; }
          .action-panel {
            min-width: 0 !important; max-width: 94vw;
            width: min(94vw, 460px);
            max-height: 44vh; overflow-y: auto; padding: 12px 14px;
          }
          .action-panel h3 { font-size: 16px; }
          .action-hint { font-size: 12px; }
          .action-buttons .btn { flex: 1; }
          .target-list .btn { min-height: 34px; }
          .log-panel { width: 62vw; max-height: 24vh; top: 156px; right: 8px; font-size: 10.5px; }
          .log-panel-bottom { left: 6px; right: 6px; bottom: 170px; width: auto; }
          .log-strip { right: 5px; padding: 9px 4px; font-size: 11px; }
          .hand-zone .game-card { touch-action: none; }
          /* 名将杀式：手机端状态条两行、对手区两行、日志抽屉贴右 */
          .game-board[data-layout="mingsha"] .board-header { flex-wrap: wrap; }
          .game-board[data-layout="mingsha"] .board-header .phase-info {
            flex: 1 1 100%; order: 10; font-size: 11px;
          }
          .game-board[data-layout="mingsha"] .other-players {
            flex-wrap: wrap; overflow-x: visible; justify-content: flex-start;
          }
          .game-board[data-layout="mingsha"] .self-zone { flex-direction: column-reverse; }
          .game-board[data-layout="mingsha"] .self-character { width: 100%; }
          .game-board[data-layout="mingsha"] .log-panel-right { width: 66vw; top: 132px; }
          .game-board[data-layout="mingsha"] .hand-title { font-size: 11.5px; }
          .game-board[data-layout="compact"] .board-header { flex-wrap: wrap; }
          .game-board[data-layout="compact"] .other-players { flex-wrap: wrap; }
        }

        /* ===== 投降 ===== */
        .surrender-trigger {
          color: #e0a39b;
          border-color: rgba(208, 87, 79, 0.38);
        }
        .surrender-trigger:hover {
          color: #ffd2cb;
          border-color: rgba(208, 87, 79, 0.75);
        }
        .surrender-overlay {
          position: fixed;
          inset: 0;
          z-index: 1250;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(4, 6, 10, 0.68);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
          animation: fadeIn 0.2s ease;
        }
        .surrender-dialog {
          width: min(420px, 92vw);
          padding: 24px 24px 20px;
          text-align: center;
          cursor: default;
        }
        .surrender-emblem {
          width: 58px;
          height: 58px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(208, 87, 79, 0.65);
          color: #e8a39b;
          font-family: var(--font-serif);
          font-size: 26px;
          font-weight: 800;
          background: radial-gradient(circle at 35% 28%, rgba(208, 87, 79, 0.18), rgba(10, 12, 17, 0.94) 72%);
          box-shadow: 0 0 24px rgba(208, 87, 79, 0.16);
        }
        .surrender-dialog h3 {
          color: #f0b0a8;
          font-size: 20px;
          margin-bottom: 8px;
        }
        .surrender-dialog p {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.65;
          margin-bottom: 18px;
        }
        .surrender-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .surrender-actions .btn { flex: 1; }
        @media (max-width: 720px) {
          .surrender-dialog { padding: 20px 16px 16px; }
          .surrender-actions { flex-direction: column-reverse; }
          .surrender-actions .btn { min-height: 44px; }
        }

        /* ===== 桌面端：右侧统一指令栏（行动 / 战局脉搏 / 快捷出牌 / 日志） ===== */
        @media (min-width: 1024px) {
          .game-board { --rail-w: 392px; --rail-pad: 24px; }
          .game-board::before {
            content: '';
            position: absolute;
            top: 58px; right: 0; bottom: 0;
            width: var(--rail-w);
            pointer-events: none;
            z-index: 0;
            border-left: 1px solid rgba(214, 185, 110, 0.14);
            background:
              repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.012) 0 1px, transparent 1px 9px),
              linear-gradient(180deg, rgba(20, 23, 30, 0.55), rgba(7, 9, 13, 0.72));
          }
          /* 布局预设里的 padding 简写会覆盖 App.css 的右栏预留，这里统一收回 */
          .game-board[data-layout] .board-main,
          .game-board[data-layout] .self-zone {
            padding-right: var(--rail-w);
          }
          .game-board .board-center { z-index: 40; }
          .game-board .board-center .action-panel {
            top: 74px !important;
            right: var(--rail-pad) !important;
            width: calc(var(--rail-w) - var(--rail-pad) * 2) !important;
            min-width: 0 !important;
            max-width: none !important;
            max-height: calc(100vh - 300px) !important;
          }
          .game-board .tactical-pulse {
            position: fixed;
            right: var(--rail-pad);
            bottom: 124px;
            width: calc(var(--rail-w) - var(--rail-pad) * 2);
            max-width: none;
            margin: 0;
            z-index: 88;
            border-radius: 12px;
          }
          .game-board .quick-play-bar {
            right: var(--rail-pad) !important;
            bottom: 64px !important;
            width: calc(var(--rail-w) - var(--rail-pad) * 2) !important;
            min-width: 0 !important;
          }
          .game-board[data-layout] .log-strip {
            position: fixed;
            right: var(--rail-pad);
            bottom: 20px;
            top: auto;
            transform: none;
            width: calc(var(--rail-w) - var(--rail-pad) * 2);
            height: 34px;
            padding: 0 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            writing-mode: horizontal-tb;
            letter-spacing: 0.16em;
            font-size: 12px;
            border-radius: 10px;
            z-index: 89;
          }
          .game-board .log-strip::before {
            content: '▤';
            margin-right: 7px;
            font-size: 13px;
            opacity: 0.8;
          }
          .game-board .other-players .player-area {
            min-width: calc(160px * var(--opponent-scale, 1));
          }
          .game-board .hub-rose {
            width: min(54vh, 470px);
            height: min(54vh, 470px);
            opacity: 0.16;
          }
          .game-board .table-hub::before { width: min(50vh, 430px); }
          .game-board .table-hub::after { width: min(42vh, 370px); }
          .game-board .board-main { gap: 10px; }
          .game-board .board-header { gap: 8px; }
          .game-board .board-header .phase-info { font-size: 13px; letter-spacing: 0.02em; }
          .game-board .board-header .layout-trigger {
            border-color: rgba(214, 185, 110, 0.5);
            color: var(--gold-bright);
          }
        }
        @media (min-width: 1024px) and (max-width: 1279px) {
          .game-board { --rail-w: 360px; --rail-pad: 18px; }
          .game-board .board-center .action-panel { top: 70px !important; }
          .game-board .tactical-pulse { bottom: 120px; }
        }

        /* ===== 可读性：阶段轨道 / 场面信息 / 回合核心 ===== */
        @media (min-width: 901px) {
          .game-board .chip {
            font-size: 12.5px;
            padding: 4px 11px;
            color: #d3cbbb;
          }
          .game-board .stage-empty { font-size: 12px; color: rgba(232, 226, 210, 0.44); }
          .game-board .phase-track { padding: 5px 14px; gap: 3px; }
          .game-board .phase-node { font-size: 11.5px; padding: 3px 10px; }
          .game-board .hub-round { font-size: 11px; opacity: 0.86; }
          .game-board .hub-phase { font-size: 12px; }
          .game-board .turn-tip { font-size: 13px; }
        }

        /* ===== 手机端：顶栏折行不裁切 / 手牌工具条收紧 ===== */
        @media (max-width: 720px) {
          .game-board .board-header {
            flex-wrap: wrap;
            overflow-x: visible;
            gap: 5px;
          }
          .game-board .board-header .phase-info {
            flex: 1 1 100%;
            order: 10;
            max-width: none;
            font-size: 11px;
          }
          .game-board .hand-toolbar {
            flex-wrap: wrap;
            gap: 4px 8px;
          }
          .game-board .hand-sort-badge { font-size: 10px; padding: 1px 6px; }
          .game-board .hand-sort-badge small { display: none; }
          .game-board .hand-sort-btn {
            margin-left: auto;
            min-height: 30px !important;
            padding: 2px 8px;
            font-size: 11px;
          }
          .game-board .hand-cards { justify-content: flex-start; padding-left: 1px; }
          .game-board .self-character { overflow: hidden; }
          .game-board .board-header .header-action { padding: 4px 7px; }
          /* 手机竖屏：对手卡与武将卡只保留有效信息，空装备框不占高度 */
          .game-board .other-players .player-area { padding: 8px; }
          .game-board .other-players .player-avatar {
            width: 38px; height: 38px; font-size: 16px;
          }
          .game-board .other-players .equip-area {
            min-height: 0; margin: 3px 0; gap: 3px;
          }
          .game-board .other-players .equip-slot.empty { display: none; }
          .game-board .other-players .equip-slot { min-height: 30px; }
          .game-board .other-players .skill-tag { font-size: 9px; padding: 1px 5px; }
          .game-board .self-character .self-equip-slot.empty { display: none; }
          .game-board .self-character .self-equip-section { gap: 4px; }
          .game-board .self-character .self-equip-slots { min-height: 0; }
        }
        @media (max-width: 520px) {
          .game-board .hand-sort-badge { display: none; }
        }

        /* ============================================================
           界面风格 1/3：墨玉鎏金（默认，保持现有材质）
           界面风格 2/3：青灰极简（冷色、弱装饰、信息优先）
           界面风格 3/3：暖木典藏（暖木、羊皮纸、厚描边）
           ============================================================ */
        .game-board[data-theme="modern"] {
          --gold: #a9cbd6;
          --gold-bright: #e4f4f8;
          --gold-deep: #5f8794;
          --accent-gold: #8fb9c9;
          --accent-gold-soft: rgba(143, 185, 201, 0.12);
          --text-primary: #e7eef0;
          --text-secondary: #9cabb1;
          --glass-border: rgba(143, 185, 201, 0.24);
          --glass-border-strong: rgba(196, 231, 240, 0.5);
          --font-calligraphy: var(--font-cn);
          --card-paper-light: #f4f9f7;
          --card-paper: #e8f1ee;
          --card-paper-deep: #d8e6e2;
          --card-edge: rgba(45, 64, 68, 0.55);
          --card-gold-line: rgba(95, 135, 148, 0.4);
        }
        .game-board[data-theme="modern"]::before {
          border-left-color: rgba(143, 185, 201, 0.18);
          background:
            repeating-linear-gradient(115deg, rgba(180, 226, 238, 0.014) 0 1px, transparent 1px 9px),
            linear-gradient(180deg, rgba(14, 23, 28, 0.58), rgba(6, 10, 13, 0.76));
        }
        .game-board[data-theme="modern"] .board-header {
          background: linear-gradient(180deg, rgba(16, 24, 29, 0.96), rgba(7, 11, 14, 0.98));
          border-color: rgba(143, 185, 201, 0.28);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .game-board[data-theme="modern"] .hand-zone {
          background: linear-gradient(160deg, rgba(17, 25, 30, 0.96), rgba(7, 11, 14, 0.98));
          border-color: rgba(143, 185, 201, 0.28);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .game-board[data-theme="modern"] .self-character {
          background:
            linear-gradient(160deg, rgba(17, 25, 30, 0.97), rgba(7, 11, 14, 0.98)) padding-box,
            linear-gradient(150deg, rgba(143, 185, 201, 0.55), rgba(255, 255, 255, 0.03) 45%, rgba(143, 185, 201, 0.18)) border-box;
          border-color: transparent;
        }
        .game-board[data-theme="modern"] .action-panel {
          background:
            linear-gradient(158deg, rgba(16, 24, 29, 0.95), rgba(7, 11, 14, 0.98)) padding-box,
            linear-gradient(152deg, rgba(143, 185, 201, 0.5), rgba(255, 255, 255, 0.04) 34%, rgba(143, 185, 201, 0.16) 68%, rgba(255, 255, 255, 0.03)) border-box;
          border-color: transparent;
        }
        .game-board[data-theme="modern"] .tactical-pulse {
          background: linear-gradient(160deg, rgba(18, 28, 33, 0.85), rgba(7, 11, 14, 0.8));
          border-color: rgba(143, 185, 201, 0.28);
        }
        .game-board[data-theme="modern"] .chip,
        .game-board[data-theme="modern"] .phase-track {
          background: linear-gradient(180deg, rgba(24, 36, 42, 0.86), rgba(9, 15, 18, 0.92));
          border-color: rgba(143, 185, 201, 0.26);
          color: #c9d8dc;
        }
        .game-board[data-theme="modern"] .log-strip {
          background: linear-gradient(180deg, rgba(18, 27, 32, 0.95), rgba(7, 11, 14, 0.97));
          border-color: rgba(143, 185, 201, 0.35);
          color: var(--accent-gold);
        }
        .game-board[data-theme="modern"] .log-strip:hover { border-color: rgba(196, 231, 240, 0.7); }
        .game-board[data-theme="modern"] .hub-rose {
          color: #9fc6d2;
          opacity: 0.11;
          animation-duration: 220s;
        }
        .game-board[data-theme="modern"] .table-hub::after { border-color: rgba(143, 185, 201, 0.22); }
        .game-board[data-theme="modern"] .hub-name {
          background: linear-gradient(104deg, #f2fbfd, #b9dce6 58%, #7ba5b2);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .game-board[data-theme="modern"] .hub-phase {
          border-color: rgba(143, 185, 201, 0.35);
          background: rgba(143, 185, 201, 0.08);
          color: var(--gold-bright);
        }
        .game-board[data-theme="modern"] .btn {
          background: linear-gradient(180deg, rgba(38, 52, 58, 0.9), rgba(15, 22, 26, 0.94));
          border-color: rgba(143, 185, 201, 0.26);
          color: #e3edf0;
        }
        .game-board[data-theme="modern"] .btn-primary {
          background: linear-gradient(180deg, #a8ced9, #6c96a4);
          border-color: #c6e8f0;
          color: #061014;
        }
        .game-board[data-theme="modern"] .btn-danger {
          background: linear-gradient(180deg, #9c4c49, #6d2c2b);
          border-color: rgba(208, 87, 79, 0.65);
        }
        .game-board[data-theme="modern"] .turn-tip {
          background: rgba(13, 20, 24, 0.66);
          border-color: rgba(143, 185, 201, 0.24);
        }

        .game-board[data-theme="tabletop"] {
          --gold: #e3b96c;
          --gold-bright: #f7dfa8;
          --gold-deep: #9a6d2f;
          --accent-gold: #e3b96c;
          --accent-gold-soft: rgba(227, 185, 108, 0.14);
          --text-primary: #f2e7d2;
          --text-secondary: #b3a48a;
          --card-paper-light: #f6e8ca;
          --card-paper: #ecd9b5;
          --card-paper-deep: #dfc79c;
          --card-edge: rgba(92, 63, 30, 0.58);
          --card-gold-line: rgba(180, 133, 62, 0.48);
        }
        .game-board[data-theme="tabletop"]::before {
          border-left-color: rgba(227, 185, 108, 0.2);
          background:
            repeating-linear-gradient(0deg, rgba(255, 220, 160, 0.018) 0 1px, transparent 1px 7px),
            linear-gradient(180deg, rgba(39, 27, 17, 0.6), rgba(16, 10, 6, 0.78));
        }
        .game-board[data-theme="tabletop"] .board-header {
          background:
            repeating-linear-gradient(0deg, rgba(255, 220, 160, 0.018) 0 1px, transparent 1px 7px),
            linear-gradient(180deg, rgba(42, 29, 19, 0.97), rgba(18, 12, 8, 0.99));
          border-color: rgba(227, 185, 108, 0.42);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 240, 210, 0.08);
        }
        .game-board[data-theme="tabletop"] .hand-zone {
          background:
            repeating-linear-gradient(0deg, rgba(255, 220, 160, 0.018) 0 1px, transparent 1px 7px),
            linear-gradient(160deg, rgba(48, 34, 22, 0.96), rgba(20, 13, 8, 0.98));
          border-color: rgba(227, 185, 108, 0.38);
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255, 240, 210, 0.07);
        }
        .game-board[data-theme="tabletop"] .self-character {
          background:
            linear-gradient(160deg, rgba(48, 34, 22, 0.97), rgba(20, 13, 8, 0.99)) padding-box,
            linear-gradient(150deg, rgba(227, 185, 108, 0.65), rgba(255, 255, 255, 0.04) 45%, rgba(227, 185, 108, 0.24)) border-box;
          border-color: transparent;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 240, 210, 0.07);
        }
        .game-board[data-theme="tabletop"] .action-panel {
          background:
            linear-gradient(158deg, rgba(46, 32, 21, 0.97), rgba(19, 12, 8, 0.99)) padding-box,
            linear-gradient(152deg, rgba(227, 185, 108, 0.64), rgba(255, 255, 255, 0.04) 34%, rgba(227, 185, 108, 0.24) 68%, rgba(255, 255, 255, 0.03)) border-box;
          border-color: transparent;
        }
        .game-board[data-theme="tabletop"] .tactical-pulse {
          background: linear-gradient(160deg, rgba(49, 34, 21, 0.88), rgba(18, 11, 7, 0.85));
          border-color: rgba(227, 185, 108, 0.34);
        }
        .game-board[data-theme="tabletop"] .chip,
        .game-board[data-theme="tabletop"] .phase-track {
          background: linear-gradient(180deg, rgba(54, 38, 24, 0.9), rgba(23, 15, 9, 0.95));
          border-color: rgba(227, 185, 108, 0.32);
          color: #e3d2b5;
        }
        .game-board[data-theme="tabletop"] .log-strip {
          background: linear-gradient(180deg, rgba(50, 34, 21, 0.96), rgba(18, 11, 7, 0.98));
          border-color: rgba(227, 185, 108, 0.44);
          color: var(--gold-bright);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }
        .game-board[data-theme="tabletop"] .hub-rose {
          color: #e3b96c;
          opacity: 0.26;
          animation-duration: 110s;
        }
        .game-board[data-theme="tabletop"] .table-hub::after { border-color: rgba(227, 185, 108, 0.28); }
        .game-board[data-theme="tabletop"] .hub-name {
          background: linear-gradient(104deg, #fff7e6, #f0d29a 54%, #c99c4e);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .game-board[data-theme="tabletop"] .hub-phase {
          border-color: rgba(227, 185, 108, 0.42);
          background: rgba(227, 185, 108, 0.1);
        }
        .game-board[data-theme="tabletop"] .btn {
          background: linear-gradient(180deg, rgba(76, 55, 35, 0.92), rgba(30, 20, 12, 0.96));
          border-color: rgba(227, 185, 108, 0.38);
          color: #f2e5cf;
        }
        .game-board[data-theme="tabletop"] .btn-primary {
          background: linear-gradient(180deg, #e3b96c, #b8843a);
          border-color: #f7dfa8;
          color: #2a1909;
        }
        .game-board[data-theme="tabletop"] .btn-danger {
          background: linear-gradient(180deg, #a95046, #6f2b26);
          border-color: rgba(214, 92, 80, 0.7);
        }
        .game-board[data-theme="tabletop"] .turn-tip {
          background: rgba(35, 23, 14, 0.7);
          border-color: rgba(227, 185, 108, 0.3);
        }
      `}</style>
    </div>
  );
}

/**
 * 选将面板：内置经典武将 + 自定义武将，展示技能名称与设置说明
 * 新增「队友 / 阵营设置」：自由混战 / 2v2 组队(4人) / 3v3 组队(6人)
 */
export function SetupPanel({
  characters, skills = [], onStart, initialTeamMode = null, initialFriendlyFire = null,
}) {
  const initialMode = normalizeTeamMode(initialTeamMode || readDefaultTeamMode());
  const initialFF = initialMode !== 'ffa'
    ? (initialFriendlyFire === null ? readDefaultFriendlyFire() : !!initialFriendlyFire)
    : false;
  const [teamMode, setTeamMode] = useState(initialMode);
  const [playerCount, setPlayerCount] = useState(() => teamPlayerCount(initialMode) || 2);
  const [friendlyFire, setFriendlyFire] = useState(initialFF);
  const [selectedChars, setSelectedChars] = useState({});
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 900000) + 100000);

  const rerollSeed = () => setSeed(Math.floor(Math.random() * 900000) + 100000);

  const handleTeamModeChange = (mode) => {
    const next = normalizeTeamMode(mode);
    setTeamMode(next);
    setPlayerCount(teamPlayerCount(next) || 2);
    // 自由混战不可误伤：重置为 false；切回组队时恢复设置页的默认值
    setFriendlyFire(next === 'ffa' ? false : readDefaultFriendlyFire());
  };

  const handleFriendlyFireChange = (checked) => {
    if (friendlyFireDisabled(teamMode)) return;
    setFriendlyFire(checked);
    saveDefaultFriendlyFire(checked);
  };

  const classicEntries = CLASSIC_CHARACTERS.map(c => ({
    id: c.id,
    name: c.name,
    groupName: GROUP_NAMES[c.group] || c.group,
    hp: c.hp,
    classic: true,
    skills: c.skillIds
      .map(id => CLASSIC_SKILLS.find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ id: s.id, name: s.name, description: s.description || '' })),
  }));

  const userEntries = (characters || []).map(c => ({
    id: c.id,
    name: c.name,
    groupName: c.groupName,
    hp: c.hp,
    classic: false,
    imageUrl: c.imageUrl || '',
    skills: (c.skillIds || [])
      .map(id => (skills || []).find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ id: s.id, name: s.name, description: s.description || '' })),
  }));

  const allEntries = [...classicEntries, ...userEntries];
  const findEntry = (id) => allEntries.find(e => e.id === id) || null;

  const handleStart = () => {
    const configs = buildTeamConfigs(playerCount, teamMode, selectedChars);
    onStart(configs, Number(seed) || null, {
      ...buildStartOptions(teamMode, friendlyFire),
      autoTrigger: readDefaultAutoTrigger(),
    });
  };

  const teamPreviewData = teamPreview(teamMode);
  const countFixed = !!teamPlayerCount(teamMode);
  const currentTeamOption = TEAM_MODE_OPTIONS.find(o => o.id === teamMode) || TEAM_MODE_OPTIONS[0];

  return (
    <div className="setup-panel panel">
      <div className="form-group">
        <label>玩家数量</label>
        <Select value={playerCount} disabled={countFixed}
          onChange={e => setPlayerCount(Number(e.target.value))}>
          {countFixed
            ? <option value={playerCount}>{playerCount}人（组队模式固定）</option>
            : [2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}人</option>)}
        </Select>
      </div>

      <div className="team-setup-section">
        <div className="setup-section-title">队友 / 阵营设置</div>
        <div className="form-group">
          <label>组队模式</label>
          <Select className="team-mode-select" value={teamMode}
            onChange={e => handleTeamModeChange(e.target.value)}>
            {TEAM_MODE_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </Select>
          <p className="team-mode-hint">{currentTeamOption.desc}</p>
        </div>
        <label className={`ff-toggle ${friendlyFireDisabled(teamMode) ? 'disabled' : ''}`}
          title={friendlyFireDisabled(teamMode)
            ? '自由混战没有队友，误伤开关不可用'
            : '开启后可用单体牌指定队友为目标'}>
          <input type="checkbox" checked={friendlyFire}
            disabled={friendlyFireDisabled(teamMode)}
            onChange={e => handleFriendlyFireChange(e.target.checked)} />
          <span>允许攻击队友（误伤）</span>
        </label>
        <p className="ff-hint">
          默认关闭；开启后玩家可把队友选为【杀】【决斗】【顺手牵羊】【过河拆桥】等目标（AI 仍不主动攻击队友）。
        </p>
        {teamPreviewData && (
          <div className="team-preview">
            <div className="team-preview-group ally">
              <span className="team-preview-label">我方</span>
              <span className="team-preview-list">{teamPreviewData.ally.join('、')}</span>
            </div>
            <div className="team-preview-group enemy">
              <span className="team-preview-label">敌方</span>
              <span className="team-preview-list">{teamPreviewData.enemy.join('、')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>牌堆种子（相同种子 = 相同牌序）</label>
        <div className="seed-row">
          <input type="number" value={seed}
            onChange={e => setSeed(e.target.value)} />
          <button className="btn btn-small" onClick={rerollSeed}>换一个</button>
        </div>
      </div>

      {Array.from({ length: playerCount }, (_, i) => {
        const entry = findEntry(selectedChars[i]);
        return (
          <div key={i} className="form-group">
            <label>{seatLabel(i, teamMode)} 的武将</label>
            {entry?.imageUrl && (
              <Portrait src={entry.imageUrl} name={entry.name} size={44} className="setup-portrait" />
            )}
            <Select value={selectedChars[i] || ''} onChange={e => setSelectedChars({ ...selectedChars, [i]: e.target.value })}>
              <option value="">无武将(基础角色：勤学/稳守)</option>
              <optgroup label="经典武将">
                {classicEntries.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.groupName} · {c.hp}体力)</option>
                ))}
              </optgroup>
              {userEntries.length > 0 && (
                <optgroup label="自定义武将">
                  {userEntries.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.groupName} · {c.hp}体力)</option>
                  ))}
                </optgroup>
              )}
            </Select>

            {entry && (
              <div className="char-skill-preview">
                {entry.skills.length === 0 && <span className="no-skill">该武将暂无技能</span>}
                {entry.skills.map(sk => (
                  <div key={sk.id} className="char-skill-row">
                    <span className="char-skill-name">【{sk.name}】</span>
                    <span className="char-skill-desc"><SkillText text={sk.description || '暂无说明'} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button className="btn btn-primary" onClick={handleStart}>
        开始对局
      </button>

      <style>{`
        .setup-panel { max-width: 460px; margin: 0 auto; }
        .setup-panel .btn { margin-top: 20px; width: 100%; }
        .seed-row { display: flex; gap: 8px; }
        .seed-row input { flex: 1; }
        .seed-row .btn { margin-top: 0; width: auto; white-space: nowrap; }
        .char-skill-preview {
          margin-top: 6px; display: flex; flex-direction: column; gap: 4px;
          padding: 8px 10px; border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .char-skill-row { display: flex; gap: 8px; font-size: 11.5px; line-height: 1.5; }
        .char-skill-name { color: var(--accent-gold); white-space: nowrap; }
        .char-skill-desc { color: var(--text-secondary); }
        .no-skill { font-size: 11px; color: var(--text-secondary); }
        /* 队友 / 阵营设置 */
        .team-setup-section {
          margin: 14px 0 4px;
          padding: 12px 12px 4px;
          border-radius: 12px;
          border: 1px solid rgba(214, 185, 110, 0.22);
          background: rgba(214, 185, 110, 0.05);
        }
        .setup-section-title {
          color: var(--accent-gold);
          font-family: var(--font-serif);
          font-size: 14px;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .team-mode-hint { font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
        .ff-toggle {
          display: inline-flex; align-items: center; gap: 8px;
          margin: 6px 0 0; font-size: 13px; color: var(--text-primary);
          cursor: pointer; flex-wrap: wrap;
        }
        .ff-toggle input { accent-color: var(--accent-gold); width: 16px; height: 16px; margin: 0; }
        .ff-toggle.disabled { opacity: 0.55; cursor: not-allowed; }
        .ff-hint { font-size: 10.5px; color: var(--text-secondary); line-height: 1.5; margin: 4px 0 8px; }
        .team-preview { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 10px; }
        .team-preview-group {
          display: flex; align-items: baseline; gap: 8px;
          padding: 6px 9px; border-radius: 9px; flex-wrap: wrap;
        }
        .team-preview-group.ally {
          background: rgba(111, 174, 134, 0.1);
          border: 1px solid rgba(111, 174, 134, 0.32);
        }
        .team-preview-group.enemy {
          background: rgba(208, 87, 79, 0.1);
          border: 1px solid rgba(208, 87, 79, 0.3);
        }
        .team-preview-label { font-size: 11.5px; font-weight: 700; }
        .team-preview-group.ally .team-preview-label { color: #9fe3c0; }
        .team-preview-group.enemy .team-preview-label { color: #f0a29b; }
        .team-preview-list { font-size: 12px; color: var(--text-primary); }
        @media (max-width: 720px) {
          .team-preview-group { flex-wrap: wrap; }
          .setup-panel { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
