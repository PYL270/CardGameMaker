import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import GameLogPanel from './GameLogPanel';
import gameBoardStyles from './gameBoardStyles';
import { handHintFor } from '../../utils/handHint';
import ChatLayer, { ChatToggleButton } from './ChatLayer';
import LayoutSettings from './LayoutSettings';
import GameSettingsPanel from './GameSettingsPanel';
import CommandPalette from './CommandPalette';
import TacticalPulse from './TacticalPulse';
import HighlightReel, { DirectorShot, highlightFromEffect, HIGHLIGHT_LIMIT } from './HighlightReel';
import { confirmDialog } from '../../utils/dialogService';
import { readLastSetup, setupSelectedChars } from '../../utils/lastSetup';
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
import { readUiPrefs, normalizeUiPrefs, uiPrefAttrs } from '../../utils/uiPrefs';
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
import { detectBonds } from '../../data/bonds';
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

/**
 * 牌桌快捷键：桌面端少点击。
 * 1–9 选对应手牌，Enter 确认出牌，Space 结束出牌，Esc 取消选择。
 * 必须独立成组件：GameBoard 在选将阶段会提前 return，Hook 放在主组件里会破坏顺序。
 */
function BoardHotkeys({
  pendingAction, isSpectator, selectedCards, selectedTarget,
  quickPlayCard, quickPlayCanConfirm, resolveAction, clearSelection,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (!pendingAction || isSpectator) return;
      const el = e.target;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.result-overlay, .layout-settings-overlay')) return;
      if (e.key === 'Escape') {
        if (selectedCards.length || selectedTarget) { clearSelection(); e.preventDefault(); }
        return;
      }
      if (pendingAction.type !== 'play') return;
      if (e.key === 'Enter') {
        if (quickPlayCanConfirm) {
          resolveAction({ card: quickPlayCard, targets: selectedTarget ? [selectedTarget] : [] });
          clearSelection();
          e.preventDefault();
        }
        return;
      }
      if (e.key === ' ') {
        resolveAction({ type: 'endPlay' });
        e.preventDefault();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const node = document.querySelectorAll('.hand-zone .game-card')[Number(e.key) - 1];
        if (node) { node.click(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingAction, isSpectator, selectedCards, selectedTarget, quickPlayCard, quickPlayCanConfirm, resolveAction, clearSelection]);
  return null;
}

export default function GameBoard({ navigate, preview = null, initialLayout = null }) {
  // 预览/测试：SSR 下 zustand 只能读到 store 初始 state，preview 允许直接渲染指定对局视图
  const storeGameState = useGameStore(s => s.gameState);
  const storeGame = useGameStore(s => s.game);
  const storePendingAction = useGameStore(s => s.pendingAction);
  const storeEffect = useGameStore(s => s.effect);
  const storeOnline = useGameStore(s => s.online);
  const gameState = preview?.gameState ?? storeGameState;
  const game = preview?.game ?? storeGame;
  const pendingAction = preview?.pendingAction ?? storePendingAction;
  const effect = preview?.effect ?? storeEffect;
  const online = preview?.online ?? storeOnline;
  const isSpectator = !!(online?.spectator || online?.role === 'spectator');
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
  const [uiPrefs, setUiPrefs] = useState(() => readUiPrefs());
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
  const recommendingRef = useRef(false);
  const [infoPanel, setInfoPanel] = useState(null);
  const [cardFx, setCardFx] = useState(null);
  const [fxQueue, setFxQueue] = useState([]);          // 演出特效队列（处决/判定/回复/雷击）
  const [tableCard, setTableCard] = useState(null);    // 出牌桌面展示
  const [discardQueue, setDiscardQueue] = useState([]); // 弃牌飞散队列
  const [highlights, setHighlights] = useState([]);     // 牌桌导演·高光战报
  const [directorShot, setDirectorShot] = useState(null); // 导演镜头（1.6s 自动淡出）
  const [showHighlightReel, setShowHighlightReel] = useState(false);
  const [bondAwaken, setBondAwaken] = useState(null);    // 羁绊觉醒横幅（2.2s）
  const dyingWatchRef = useRef(null);
  const highlightSeqRef = useRef(0);
  const recordedEffectsRef = useRef(new Set());
  const bondAwakenShownRef = useRef('');

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

  const selfDrag = usePanelDrag('selfzone');

  const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  };

  const bondStateKey = (bonds = []) => (Array.isArray(bonds) ? bonds : [])
    .map(bond => bond?.id || bond?.name || '')
    .filter(Boolean)
    .join(',');
  const bondPlayerKey = (state = gameState) => (state?.players || [])
    .map(player => player?.id || '')
    .join(',');

  /** 写入高光战报；仅在显示飘字且未开启 reduced-motion 时触发导演镜头 */
  const recordHighlight = (entry, extra = {}) => {
    if (!entry) return null;
    const id = `hl_${Date.now()}_${++highlightSeqRef.current}`;
    const item = {
      id,
      round: Number(entry.round) || Number(gameState?.round) || 0,
      type: entry.type || 'turn',
      text: entry.text || '',
      tone: entry.tone || 'calm',
      amount: entry.amount ?? null,
      time: Date.now(),
    };
    setHighlights(prev => [...prev, item].slice(-HIGHLIGHT_LIMIT));
    if (entry.major && layout.showFloats && !prefersReducedMotion()) {
      setDirectorShot({
        id,
        round: item.round,
        title: extra.title || '高光时刻',
        subtitle: item.text,
        members: extra.members || [],
        tone: item.tone,
      });
    }
    return item;
  };

  // 导演镜头 1.6s 自动淡出（不阻塞点击）
  useEffect(() => {
    if (!directorShot) return undefined;
    const timer = setTimeout(() => setDirectorShot(null), 1600);
    return () => clearTimeout(timer);
  }, [directorShot?.id]);

  // 羁绊觉醒横幅：2.2s 后自动收起（联机 effect 同样生效）
  useEffect(() => {
    if (!effect || effect.type !== 'bondAwaken') return undefined;
    const bonds = Array.isArray(effect.bonds) && effect.bonds.length
      ? effect.bonds
      : [{
        id: effect.bondId || 'bond',
        name: effect.bondName || '羁绊觉醒',
        members: Array.isArray(effect.members)
          ? effect.members.map(member => (typeof member === 'string' ? member : member?.name)).filter(Boolean)
          : [],
        desc: '',
      }];
    setBondAwaken({ id: effect.id || `${Date.now()}`, bonds });
    bondAwakenShownRef.current = `${bondPlayerKey()}|${bondStateKey(bonds)}`;
    const timer = setTimeout(() => setBondAwaken(null), 2200);
    return () => clearTimeout(timer);
  }, [effect?.id, effect?.type]);

  // 兜底：联机首帧/本地 effect 被后续演出覆盖时，仍让开局羁绊觉醒被看见
  useEffect(() => {
    if (!gameState || gameState.status !== 'running') return undefined;
    const bonds = Array.isArray(gameState.bonds) ? gameState.bonds : [];
    if (!bonds.length) return undefined;
    const signature = `${bondPlayerKey(gameState)}|${bondStateKey(bonds)}`;
    if (!signature || bondAwakenShownRef.current === signature) return undefined;
    bondAwakenShownRef.current = signature;
    setBondAwaken({ id: `state_${signature}`, bonds });
    const timer = setTimeout(() => setBondAwaken(null), 2200);
    return () => clearTimeout(timer);
  }, [gameState?.status, gameState?.bonds, gameState?.players?.[0]?.id]);

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

  // 界面增强偏好：挂到 <html>，供全局 CSS 使用；设置页改动可实时同步
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const attrs = uiPrefAttrs(uiPrefs);
    Object.entries(attrs).forEach(([key, value]) => {
      document.documentElement.setAttribute(key, value);
    });
  }, [uiPrefs]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPrefs = (event) => {
      setUiPrefs(normalizeUiPrefs(event?.detail || readUiPrefs()));
    };
    window.addEventListener('cgm:ui-prefs', onPrefs);
    return () => window.removeEventListener('cgm:ui-prefs', onPrefs);
  }, []);

  // 日志位置切到“隐藏”时收起
  useEffect(() => {
    if (layout.logPosition === 'hidden') setShowLog(false);
  }, [layout.logPosition]);

  // 对局结束后关闭投降确认框（联机结算/重开同样生效）
  useEffect(() => {
    if (gameState?.status !== 'running') setShowSurrenderConfirm(false);
  }, [gameState?.status]);

  // 重开/新局清空高光与导演状态（联机客户端收到房主重开同样生效）
  const lastGameStatusRef = useRef(null);
  useEffect(() => {
    const status = gameState?.status || null;
    const restarted = lastGameStatusRef.current === 'finished' && status === 'running';
    if (status === 'idle' || restarted) {
      setHighlights([]);
      setDirectorShot(null);
      setShowHighlightReel(false);
      setBondAwaken(null);
      bondAwakenShownRef.current = '';
      dyingWatchRef.current = null;
    }
    lastGameStatusRef.current = status;
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
    if (effect.id && recordedEffectsRef.current.has(effect.id)) return;
    if (effect.id) {
      recordedEffectsRef.current.add(effect.id);
      if (recordedEffectsRef.current.size > 80) {
        const oldest = recordedEffectsRef.current.values().next().value;
        recordedEffectsRef.current.delete(oldest);
      }
    }

    const mySeat = online.active ? online.seat : 0;
    const myPlayer = game?.players?.find(p => p.seatNum === mySeat)
      || gameState?.players?.find(p => p.seatNum === mySeat);
    const selfId = myPlayer?.id;
    const effectPlayerId = effect.player?.id || effect.playerId || null;
    const effectIsSelf = effectPlayerId === selfId;

    // 高光捕获：伤害≥2 / 击杀 / 濒死被救 / 雷击判定 / 羁绊合击
    const statePlayers = gameState?.players || game?.players || [];
    const findPlayer = (id) => (id ? statePlayers.find(p => p?.id === id) || null : null);
    const dyingId = effect.player?.id || effect.playerId || effect.target?.id || effect.targetId || null;
    const dyingWatch = dyingWatchRef.current;
    const wasDying = effect.type === 'heal'
      && !!dyingWatch
      && dyingWatch.id === dyingId
      && Date.now() - dyingWatch.at < 30000;
    if (effect.type === 'dying' && dyingId) {
      dyingWatchRef.current = { id: dyingId, at: Date.now() };
    }
    if (wasDying) dyingWatchRef.current = null;
    const richEffect = {
      ...effect,
      player: effect.player?.name ? effect.player : (findPlayer(dyingId) || effect.player),
      target: effect.target?.name ? effect.target : (findPlayer(effect.targetId) || effect.target),
      source: effect.source?.name ? effect.source : (findPlayer(effect.sourceId) || effect.source),
    };
    const highlight = highlightFromEffect(richEffect, {
      round: gameState?.round || 0,
      wasDying,
    });
    if (highlight) {
      const bondMembers = effect.type === 'bondCombo' && Array.isArray(effect.members)
        ? effect.members.map(m => (typeof m === 'string' ? m : m?.name)).filter(Boolean)
        : [];
      const directorTitles = {
        kill: '阵斩',
        bond: effect.bondName || '羁绊合击',
        judge: '雷击判定',
        heal: '濒死回生',
        damage: '重创',
      };
      recordHighlight(highlight, {
        title: directorTitles[highlight.type] || '高光时刻',
        members: bondMembers,
      });
    }

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
    setHighlights([]);
    setDirectorShot(null);
    setShowHighlightReel(false);
    setBondAwaken(null);
    bondAwakenShownRef.current = '';
    dyingWatchRef.current = null;
    try {
      await restartGame();
    } catch (e) {
      console.error('重新开始失败:', e);
    } finally {
      setRestarting(false);
    }
  };

  const handleExit = async () => {
    if (gameState?.status === 'running') {
      const confirmed = await confirmDialog({
        title: '退出对局',
        message: '对局尚未结束，确定退出吗？',
        confirmText: '退出',
        danger: true,
        kicker: 'LEAVE BATTLE',
      });
      if (!confirmed) return;
    }
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
      {layout.showFloats && <DirectorShot shot={directorShot} />}
      {layout.showBanner && bondAwaken && (
        <div className="bond-awaken-banner" key={`bond-${bondAwaken.id}`} role="status">
          <span className="bond-awaken-kicker">武将羁绊 · 觉醒</span>
          <div className="bond-awaken-list">
            {bondAwaken.bonds.map((bond, index) => (
              <div className="bond-awaken-item" key={`${bond.id || bond.name}-${index}`}>
                <strong className="bond-awaken-name">{bond.name}</strong>
                <span className="bond-awaken-members">
                  {(bond.members || []).map(member => (
                    typeof member === 'string' ? member : member?.name
                  )).filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <button className="btn btn-small header-action" title="退出对局并返回主菜单" aria-label="退出对局" onClick={handleExit}>
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
        <button className="btn btn-small header-action" title="查看牌与规则说明" aria-label="查看说明" onClick={() => setShowGuide(true)}>
          <Icon name="book" size={15} /><span className="btn-label">说明</span>
        </button>
        {online.active && (
          <ChatToggleButton
            chatOpen={chatOpen}
            onToggle={() => setChatOpen(v => !v)}
          />
        )}
        {layout.logPosition !== 'hidden' && (
          <button className="btn btn-small header-action"
            title={showLog ? '收起对局日志' : '展开对局日志'}
            aria-label={showLog ? '收起日志' : '展开日志'}
            onClick={() => setShowLog(v => !v)}>
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
          <button className="btn btn-small header-action"
            title={online.active ? '重新开始本局' : '重新开始一局'}
            aria-label="重新开始"
            onClick={handleRestart} disabled={restarting}>
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
            selectedCards={selectedCards}
            currentPlayer={currentPlayer}
            pendingAction={pendingAction}
            currentPhase={currentPhase}
            phaseLabel={PHASE_NAMES[currentPhase] || currentPhase || ''}
            spectator={isSpectator}
            game={game}
            teamMode={teamMode}
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
        <ChatLayer
          online={online}
          isSpectator={isSpectator}
          chatOpen={chatOpen}
          onCloseChat={() => setChatOpen(false)}
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
        <GameLogPanel
          logs={preview?.logs}
          showLog={showLog}
          logPosition={layout.logPosition}
          onCollapse={() => setShowLog(false)}
        />
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
          hasHighlights={highlights.length > 0}
          onOpenHighlights={() => setShowHighlightReel(true)}
          onMenu={() => {
            if (online.active) leaveOnline();
            navigate('menu');
          }}
        />
      )}

      {showHighlightReel && (
        <HighlightReel
          highlights={highlights}
          onClose={() => setShowHighlightReel(false)}
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

      <BoardHotkeys
        pendingAction={pendingAction}
        isSpectator={isSpectator}
        selectedCards={selectedCards}
        selectedTarget={selectedTarget}
        quickPlayCard={quickPlayCard}
        quickPlayCanConfirm={quickPlayCanConfirm}
        resolveAction={resolveAction}
        clearSelection={clearSelection}
      />

      <style>{gameBoardStyles}</style>
    </div>
  );
}

/**
 * 选将面板：内置经典武将 + 自定义武将，展示技能名称与设置说明
 * 新增「队友 / 阵营设置」：自由混战 / 2v2 组队(4人) / 3v3 组队(6人)
 */
export function SetupPanel({
  characters, skills = [], onStart, initialTeamMode = null, initialFriendlyFire = null,
  initialSelectedChars = null, initialPlayerCount = null,
}) {
  // 上次阵容回填：点过「布阵」回来时，人数 / 模式 / 武将都还是上一局的样子
  const lastSetup = useMemo(() => readLastSetup(), []);
  const initialMode = normalizeTeamMode(initialTeamMode || lastSetup?.teamMode || readDefaultTeamMode());
  const initialFF = initialMode !== 'ffa'
    ? (initialFriendlyFire === null ? readDefaultFriendlyFire() : !!initialFriendlyFire)
    : false;
  const [teamMode, setTeamMode] = useState(initialMode);
  const [playerCount, setPlayerCount] = useState(() => {
    const fixed = teamPlayerCount(initialMode);
    if (fixed) return fixed;
    if (Number(initialPlayerCount) >= 2) return Math.min(6, Number(initialPlayerCount));
    return lastSetup?.configs?.length || 2;
  });
  const [friendlyFire, setFriendlyFire] = useState(initialFF);
  const [selectedChars, setSelectedChars] = useState(() => (
    initialSelectedChars && typeof initialSelectedChars === 'object'
      ? { ...initialSelectedChars }
      : setupSelectedChars(lastSetup)
  ));
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
  const selectedBondPlayers = Array.from({ length: playerCount }, (_, index) => {
    const characterId = selectedChars[index];
    if (!characterId) return null;
    const entry = findEntry(characterId);
    return {
      id: `setup_${index}`,
      name: entry?.name || characterId,
      seatNum: index,
      characterId,
      character: { id: characterId, name: entry?.name || characterId },
    };
  }).filter(Boolean);
  const activeBonds = detectBonds(selectedBondPlayers);

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

      {activeBonds.length > 0 && (
        <div className="bond-setup-preview">
          <div className="bond-setup-title">激活羁绊 · {activeBonds.length}</div>
          {activeBonds.map(bond => (
            <div className="bond-setup-row" key={bond.id}>
              <div className="bond-setup-head">
                <span className="bond-tag bond-setup-tag">{bond.name}</span>
                <span className="bond-setup-members">
                  {bond.members.map(member => member.name).join(' · ')}
                </span>
              </div>
              <p className="bond-setup-desc">{bond.desc}</p>
              <p className="bond-setup-combo">组合技：{bond.comboDesc}</p>
            </div>
          ))}
        </div>
      )}

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
