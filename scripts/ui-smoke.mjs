/**
 * UI 渲染冒烟测试：用 React SSR 渲染各页面/组件，验证无渲染期错误
 * 运行方式: node scripts/run-ui-smoke.mjs
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import MainMenu from '../src/components/Menu/MainMenu.jsx';
import QuickPlay from '../src/components/Menu/QuickPlay.jsx';
import App from '../src/App.jsx';
import {
  parseLaunchParams,
  buildLanAddress,
  buildQuickPlayUrl,
  resolveQuickPlayQr,
  pickQuickPlayLayout,
  buildQuickPlayConfigs,
} from '../src/components/Menu/quickPlay.js';
import Settings from '../src/components/Menu/Settings.jsx';
import MobileApkPanel, {
  normalizeApkInfo,
  normalizeApiStatus,
  normalizeLatest,
  normalizeHistory,
  buildApkUrl,
  formatBytes,
  tailLog,
  FALLBACK_APP_VERSION,
} from '../src/components/Menu/MobileApkPanel.jsx';
import MobileNotice from '../src/components/Menu/MobileNotice.jsx';
import {
  isMobileApp,
  isMobileDevice,
  mobileDeviceLabel,
  isTouchInput,
  getPlatform,
  MOBILE_LIMITATIONS,
} from '../src/utils/mobile.js';
import AudioSettings from '../src/components/Menu/AudioSettings.jsx';
import AppearanceSettings from '../src/components/Menu/AppearanceSettings.jsx';
import GameBoard, { handHintFor, SetupPanel } from '../src/components/GameBoard/GameBoard.jsx';
import LayoutSettings from '../src/components/GameBoard/LayoutSettings.jsx';
import {
  PRESET_SETTINGS,
  LAYOUT_STORAGE_KEY,
  HAND_SCALE_MIN,
  HAND_SCALE_MAX,
  THEME_OPTIONS,
  defaultLayout,
  applyPreset,
  normalizeLayout,
  themeOption,
  updateLayout,
  clampHandScale,
  layoutData,
  layoutStyle,
  loadLayout,
  saveLayout,
  clearLayout,
  shouldOpenLog,
} from '../src/components/GameBoard/layoutConfig.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import PlayerArea from '../src/components/GameBoard/PlayerArea.jsx';
import HandZone, {
  sortHandCards,
  nextHandSortMode,
  normalizeHandSortMode,
  handSortLabel,
  loadHandSortMode,
  saveHandSortMode,
  HAND_SORT_STORAGE_KEY,
  HAND_DRAG_THRESHOLD,
} from '../src/components/GameBoard/HandZone.jsx';
import { QuickPlayBar, AiThinkingBadge } from '../src/components/GameBoard/QuickPlayBar.jsx';
import ChatDock, {
  CHAT_MAX_LENGTH,
  loadDanmakuEnabled,
  saveDanmakuEnabled,
  normalizeChatMessages,
  normalizeMutedIds,
  filterChatMessages,
} from '../src/components/GameBoard/ChatDock.jsx';
import DanmakuLayer from '../src/components/GameBoard/DanmakuLayer.jsx';
import GameSettingsPanel, {
  readGameAiDelay,
  saveGameAiDelay,
  AI_DELAY_MIN as GAME_SETTINGS_AI_MIN,
  AI_DELAY_MAX as GAME_SETTINGS_AI_MAX,
  AI_DELAY_DEFAULT as GAME_SETTINGS_AI_DEFAULT,
} from '../src/components/GameBoard/GameSettingsPanel.jsx';
import CommandPalette, { filterCommands } from '../src/components/GameBoard/CommandPalette.jsx';
import TacticalPulse, { buildTacticalPulse } from '../src/components/GameBoard/TacticalPulse.jsx';
import { buildEquipSlots, equipChoiceEntries, normalizeEquipLimit } from '../src/components/GameBoard/equipSlots.js';
import { computeCardTilt, shouldEnableCardTilt, CARD_TILT_MAX_DEG } from '../src/components/GameBoard/cardTilt.js';
import ArtStudio from '../src/components/Editor/ArtStudio.jsx';
import Portrait from '../src/components/ui/Portrait.jsx';
import {
  ART_PROVIDERS,
  ART_STYLES,
  ART_SIZES,
  CUSTOM_PRESETS,
  STABLE_HORDE_ANON_KEY,
  STABLE_HORDE_CLIENT_AGENT,
  customImagesEndpoint,
  DEFAULT_PROVIDER,
  DEFAULT_NEGATIVE,
  SAFETY_PREFIX,
  ART_CONFIG_KEY,
  buildArtRequest,
  buildPrompt,
  buildNegative,
  normalizeArtSize,
  normalizeSeed,
  isSafeImageUrl,
  readArtConfig,
  saveArtConfig,
  suggestPrompt,
  getArtProvider,
  generateArt,
  analyzeStableHordeError,
  inspectArtProvider,
  checkArtProviderConnection,
  ART_FREE_GUIDE,
  HORDE_ANON_LIMITS,
  applyAnonymousHordeLimits,
  canClampHordeRequest,
  clampHordeRequestToAnonymous,
} from '../src/ai/artProviders.js';
import { validateImageFile, fitImageSize, MAX_IMPORT_BYTES } from '../src/ai/imageImport.js';
import { SFX_CATEGORIES, SFX_SLOTS, BUILTIN_SFX } from '../src/audio/audioManager.js';
import {
  mapEffectToFx,
  enqueueFx,
  shiftFx,
  parseFxPreview,
  buildPreviewFx,
  fxDuration,
} from '../src/components/GameBoard/effectFx.js';
import {
  ExecutionOverlay,
  DyingPulse,
  JudgeReveal,
  HealPop,
  ThunderFlash,
} from '../src/components/GameBoard/FxOverlay.jsx';
import FxLayer from '../src/components/GameBoard/FxOverlay.jsx';
import { TableCardStage, DiscardBurst } from '../src/components/GameBoard/TableCardStage.jsx';
import {
  mapTableCardEffect,
  mapDiscardEffect,
  enqueueDiscard,
  shiftDiscard,
} from '../src/components/GameBoard/tableStageFx.js';
import SelfCharacterCard from '../src/components/GameBoard/SelfCharacterCard.jsx';
import CardGuide, { mergeGuideEntries } from '../src/components/GameBoard/CardGuide.jsx';
import { getCardText } from '../src/data/cardText.js';
import CardFace from '../src/components/GameBoard/CardFace.jsx';
import InfoPanel from '../src/components/GameBoard/InfoPanel.jsx';
import FontPicker from '../src/components/Menu/FontPicker.jsx';
import SkillComposer, { buildPayload } from '../src/components/Editor/SkillComposer.jsx';
import {
  normalizeComposerSkill,
  applyComposerTriggerChange,
  applyComposerTypeChange,
  normalizeEditorSkillType,
  typeForTrigger,
  skillTypeInfo,
  SKILL_TYPE_META,
} from '../src/components/ui/skillType.js';
import SkillText, { SkillKeywordLegend } from '../src/components/ui/SkillText.jsx';
import {
  tokenizeSkillText,
  joinSkillTokens,
  SKILL_KEYWORD_GROUPS,
} from '../src/components/ui/skillText.js';
import ActionPanel, { toggleFangtianTarget } from '../src/components/GameBoard/ActionPanel.jsx';
import ResultOverlay from '../src/components/GameBoard/ResultOverlay.jsx';
import Icon, { ICON_NAMES } from '../src/components/ui/Icon.jsx';
import Select, { collectSelectOptions } from '../src/components/ui/Select.jsx';
import OnlineLobby from '../src/components/Menu/OnlineLobby.jsx';
import CharacterEditor from '../src/components/Editor/CharacterEditor.jsx';
import CharacterCardPreview from '../src/components/Editor/CharacterCardPreview.jsx';
import VoiceStudio from '../src/components/Editor/VoiceStudio.jsx';
import {
  VOICE_CONFIG_KEY,
  DEFAULT_VOICE_REF,
  DEFAULT_PIPER_API_BASE,
  PIPER_TEXT_LIMIT,
  VOICE_PROVIDERS,
  buildVoiceRequest,
  buildPiperRequest,
  buildDefaultVoiceText,
  mapVoiceError,
  mapPiperError,
  piperErrorFromException,
  normalizeVoiceConfig,
  normalizeVoiceText,
  isSpeechSupported,
  listBrowserVoices,
  pickChineseVoice,
  speakText,
  stopSpeech,
  generateGptSpeech,
  generatePiperSpeech,
  checkPiperHealth,
  readVoiceConfig,
  saveVoiceConfig,
  waitForBrowserVoices,
  speechErrorMessage,
} from '../src/ai/voiceTTS.js';
import {
  CHARACTER_DRAFT_KEY,
  blankCharacterForm,
  normalizeCharacterForm,
  normalizeGroup,
  normalizeSex,
  matchSkillsByName,
  isCardEditorPayload,
  isGameCharacterPayload,
  extractCharacterImport,
  buildCharacterExport,
  buildCharacterSavePayload,
  saveCharacterDraft,
  loadCharacterDraft,
  buildWorkshopInitialState,
} from '../src/components/Editor/characterWorkshopModel.js';
import SkillEditor from '../src/components/Editor/SkillEditor.jsx';
import CodePreview from '../src/components/Editor/CodePreview.jsx';
import Game from '../src/core/Game.js';
import Card from '../src/core/Card.js';
import useGameStore, {
  normalizeAiDelay,
  normalizeEquipChoiceEntries,
  AI_DELAY_MIN,
  AI_DELAY_MAX,
  AI_DELAY_DEFAULT,
} from '../src/store/gameStore.js';
import { net } from '../src/net/netClient.js';
import { serializeEffect, serializePlayerPublic, serializeState } from '../src/net/serialize.js';
import {
  TEAM_MODE_OPTIONS,
  normalizeTeamMode,
  isTeamMode,
  teamModeLabel,
  teamPlayerCount,
  seatTeam,
  playerTeamOf,
  seatLabel,
  teamPreview,
  buildTeamConfigs,
  teamChipFor,
  teamClassFor,
  computeTeamOutcome,
  readDefaultTeamMode,
  saveDefaultTeamMode,
  friendlyFireDisabled,
  normalizeFriendlyFire,
  buildStartOptions,
  isTeammateTarget,
  readDefaultFriendlyFire,
  saveDefaultFriendlyFire,
  readDefaultAutoTrigger,
  saveDefaultAutoTrigger,
  normalizeAutoTrigger,
  GAME_CONFIG_STORAGE_KEY,
} from '../src/components/GameBoard/teamConfig.js';
import {
  aliveSeatOrder,
  seatDistance,
  attackDistance,
  attackRange,
  isInAttackRange,
  distanceHint,
  attackRangeHint,
  targetLabelWithDistance,
  weaponName,
} from '../src/components/GameBoard/distanceInfo.js';

let passed = 0;
let failed = 0;
function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

const noop = () => {};

function renderPage(name, element, mustContain = []) {
  try {
    const html = renderToString(element);
    assert(html.length > 0, `${name} 渲染成功`, `长度 ${html.length}`);
    for (const text of mustContain) {
      assert(html.includes(text), `${name} 包含「${text}」`);
    }
  } catch (e) {
    assert(false, `${name} 渲染异常`, e.message);
  }
}

async function main() {
  console.log('\n[1] 主菜单');
  renderPage('MainMenu', React.createElement(MainMenu, { navigate: noop }),
    ['CardGameMaker', '开始游戏', '速玩', '武将编辑器', '技能编辑器', '代码生成区', '音频设置', '背景设置']);

  console.log('\n[2] 设置页');
  renderPage('Settings', React.createElement(Settings, { navigate: noop }),
    ['设置', 'AI代码生成设置', '数据管理', '界面布局', '名将杀式', '打开完整布局设置',
      '默认组队模式', '2v2 组队', '3v3 组队', '默认允许误伤队友',
      '可选触发技自动发动']);

  console.log('\n[2b] 音频设置页');
  renderPage('AudioSettings', React.createElement(AudioSettings, { onBack: noop }),
    ['音频设置', '背景音乐', '主菜单背景音乐', '音效', '上传音频', '主音量', '内置 · 山河']);

  console.log('\n[2c] 背景设置页');
  renderPage('AppearanceSettings', React.createElement(AppearanceSettings, { onBack: noop }),
    ['背景设置', '墨玉流云', '山河云海', '战火余烬', '星夜流光', '自定义背景', '上传图片', '启用动态效果']);

  console.log('\n[3] 武将编辑器');
  renderPage('CharacterEditor', React.createElement(CharacterEditor, { navigate: noop }),
    ['武将 · 卡牌工坊', '武将编辑器', '保存武将', '导入 JSON', '导出 JSON',
      '技能', '立绘', '已有武将', '实时预览']);

  console.log('\n[4] 技能编辑器');
  renderPage('SkillEditor', React.createElement(SkillEditor, { navigate: noop }),
    ['技能编辑器', '创建新技能', '触发时机', '代码定义']);

  console.log('\n[5] 代码生成区');
  renderPage('CodePreview', React.createElement(CodePreview, { navigate: noop }),
    ['代码生成区', '模板生成', 'AI生成']);

  console.log('\n[6] 游戏桌面(未开局 => 选将面板)');
  renderPage('GameBoard', React.createElement(GameBoard, { navigate: noop }),
    ['游戏设置', '玩家数量', '开始对局', '经典武将', '曹操', '诸葛亮',
      '队友 / 阵营设置', '组队模式', '2v2 组队', '3v3 组队', '自由混战']);

  console.log('\n[7] 游戏桌面子组件(实时数据)');
  const game = new Game();
  await game.init([
    { name: '你', isAI: false },
    { name: 'AI2', isAI: true },
  ]);
  const self = game.players[0];
  const enemy = game.players[1];
  // 固定手牌，保证渲染内容稳定
  self.handCards = [];
  self.handCards.push(new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }));
  self.handCards.push(new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }));
  self.drawCards(self.handCards); // 设置 owner/position

  renderPage('PlayerArea(自己)', React.createElement(PlayerArea, {
    player: self, isSelf: true, isCurrent: true, selectable: false,
    selectedCards: [], onCardSelect: noop,
  }), ['你', '杀', '闪']);

  renderPage('PlayerArea(对手)', React.createElement(PlayerArea, {
    player: enemy, isSelf: false, isCurrent: false, selectable: true, onSelect: noop,
  }), ['AI2']);

  const jiuPlayer = { ...self.toJSON(), usedJiu: true, hp: 1 };
  renderPage('PlayerArea(酒/低血状态)', React.createElement(PlayerArea, {
    player: jiuPlayer, isSelf: true, isCurrent: false, selectable: false, onInfo: noop,
  }), ['酒', '危险', 'status-jiu', 'status-low', 'clickable']);
  renderPage('SelfCharacterCard(酒/低血状态)', React.createElement(SelfCharacterCard, {
    player: jiuPlayer, onInfo: noop,
  }), ['酒', '危险', 'status-jiu', 'status-low', 'clickable']);

  const faceCard = self.handCards[0];
  renderPage('CardFace(可点击说明)', React.createElement(CardFace, {
    card: faceCard,
    onInfo: noop,
  }), [faceCard.name, 'clickable']);
  renderPage('CardFace(日曜花色)', React.createElement('div', { className: 'game-card sun' },
    React.createElement(CardFace, {
      card: { name: '杀', suit: 'sun', number: 2, numberDisplay: '2', type: 'basic' },
      info: { brief: '造成1点伤害', detail: '造成1点伤害' },
    })), ['☀', 'sun', '杀']);
  renderPage('CardFace(月华花色)', React.createElement('div', { className: 'game-card moon' },
    React.createElement(CardFace, {
      card: { name: '闪', suit: 'moon', number: 3, numberDisplay: '3', type: 'basic' },
      info: { brief: '抵消杀', detail: '抵消杀' },
    })), ['☾', 'moon', '闪']);
  renderPage('InfoPanel(说明浮层)', React.createElement(InfoPanel, {
    info: { title: '酒 · 状态', desc: '下一张【杀】伤害+1', x: 10, y: 10 },
    onClose: noop,
    onOpenGuide: noop,
  }), ['酒 · 状态', '下一张【杀】伤害+1', '关闭说明', '查看完整说明']);

  renderPage('FontPicker(字体方案)', React.createElement(FontPicker), [
    '墨韵', '宋雅', '清黑', '千秋墨韵', '字体仅影响界面标题与正文',
  ]);
  renderPage('SkillComposer(模块化拼装)', React.createElement(SkillComposer, { onApply: noop }), [
    '模块化技能拼装', '触发时机', '发动条件', '发动代价', '执行效果', '频率限制',
    '烈火', '青囊', '铁壁', '【发动条件】',
  ]);

  const sha = self.handCards[0];
  renderPage('ActionPanel(出牌阶段)', React.createElement(ActionPanel, {
    action: { type: 'play', player: self },
    onResolve: noop,
    selectedCards: [sha],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
    onRecommend: noop,
  }), ['出牌阶段', '确认出牌', '结束出牌', '推荐出牌', '杀']);

  renderPage('ActionPanel(弃牌阶段)', React.createElement(ActionPanel, {
    action: { type: 'discard', player: self, count: 1 },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['弃牌阶段', '确认弃牌']);

  renderPage('ActionPanel(响应请求)', React.createElement(ActionPanel, {
    action: { type: 'respond', player: self, filter: (c) => c.name === '闪' },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['响应请求', '使用', '不使用']);

  renderPage('ActionPanel(主动技能)', React.createElement(ActionPanel, {
    action: {
      type: 'play',
      player: self,
      activeSkills: [
        { id: 'cls_zhiheng', name: '制衡', description: '弃置任意张手牌，然后摸等量的牌' },
        { id: 'cls_rende', name: '仁德', description: '交给其他角色一张手牌并回复1点体力' },
      ],
    },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['主动技能', '制衡', '仁德']);

  renderPage('ActionPanel(技能选牌)', React.createElement(ActionPanel, {
    action: {
      type: 'selectCards',
      player: self,
      cards: [self.handCards[0], self.handCards[1]],
      min: 1,
      max: 2,
      hint: '【制衡】选择要弃置的牌（可多选）',
    },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['选择手牌', '制衡', '确认', '取消']);

  renderPage('ActionPanel(技能选目标)', React.createElement(ActionPanel, {
    action: {
      type: 'chooseTarget',
      player: self,
      candidates: [enemy],
      hint: '【仁德】选择获得手牌的角色',
    },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['选择目标', '仁德', 'AI2', '取消']);

  console.log('\n[8] 三国杀式手牌区与武将卡');
  renderPage('HandZone(有牌)', React.createElement(HandZone, {
    cards: self.handCards,
    selectedCards: [self.handCards[0]],
    canSelect: () => true,
    dimDisabled: true,
    onToggleCard: noop,
    hint: '选择一张手牌',
  }), ['你的手牌', '一键整理', self.handCards[0].name, 'selected', '选择一张手牌', '造成1点伤害',
    'hand-sort-badge', '按类型', '下次花色']);

  renderPage('HandZone(空)', React.createElement(HandZone, {
    cards: [], selectedCards: [], canSelect: () => false, onToggleCard: noop,
  }), ['暂无手牌']);

  renderPage('SelfCharacterCard', React.createElement(SelfCharacterCard, {
    player: self, hit: false, damage: null, onPointerDown: noop, onDoubleClick: noop,
  }), ['你', '基础角色', 'data-icon="heart"', '勤学', '稳守']);

  renderPage('CardGuide(卡牌说明)', React.createElement(CardGuide, { onClose: noop }),
    ['卡牌与技能说明', '基本牌', '造成1点伤害', '基础角色技能', '勤学', '稳守',
      '经典武将技能', '曹操', '奸雄', '关羽', '武圣', '关闭']);

  console.log('\n[8b] 卡牌说明分组（坐骑差异化后各自独立展示）');
  const guideHtml = renderToString(React.createElement(CardGuide, { onClose: noop }));
  const mountNames = ['绝影', '的卢', '爪黄飞电', '赤兔', '大宛', '紫骍'];
  for (const name of mountNames) {
    const info = getCardText(name);
    const count = guideHtml.split(name).length - 1;
    assert(count === 1, `坐骑「${name}」独立显示一次`, `count=${count}`);
    assert(!!info.detail && info.detail.includes(name === '绝影' || name === '的卢' || name === '爪黄飞电'
      ? '防御马' : '进攻马'), `坐骑「${name}」说明含坐骑类型`);
  }
  const mountDetails = mountNames.map(name => getCardText(name).detail);
  assert(new Set(mountDetails).size === mountNames.length, '6 张坐骑说明文字互不相同');
  for (const detail of mountDetails) {
    assert(guideHtml.includes(detail), `说明面板展示坐骑独有效果：${detail.slice(0, 10)}…`);
  }
  assert(!guideHtml.includes('绝影 / 的卢') && !guideHtml.includes('赤兔 / 大宛'),
    '说明不同的坐骑不再被合并（旧“防御马/进攻马合并”断言已按新数据更新）');
  // 通用合并逻辑仍保留：只有 detail 完全相同的牌才合并（mock 数据）
  const mockLookup = (name) => ({
    A: { detail: '相同说明', brief: '甲' },
    B: { detail: '相同说明', brief: '乙' },
    C: { detail: '另一条说明', brief: '丙' },
  }[name]);
  const mergedMock = mergeGuideEntries(['A', 'B', 'C'], mockLookup);
  assert(mergedMock.length === 2 && mergedMock[0].names.join(' / ') === 'A / B',
    '相同说明的牌仍按 detail 合并（通用逻辑保留）');
  assert(mergedMock[1].names.join(' / ') === 'C', '不同说明的牌各自独立');
  // 装备点击说明：PlayerArea 装备标签使用 cardText 的 detail（自动生效）
  const mountPlayer = {
    id: 'mount-p1', name: '坐骑测试', seatNum: 0, isAI: false, status: 'alive',
    hp: 4, maxHp: 4, hujia: 0, handCards: [], handCardCount: 0,
    equips: { horse_def: { id: 'mount-c1', name: '绝影', suit: 'spade', number: 5, type: 'equip', subtype: 'horse_def' } },
    judgeCards: [], skills: [], usedJiu: false,
  };
  renderPage('PlayerArea(坐骑装备标签)', React.createElement(PlayerArea, {
    player: mountPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  }), ['绝影']);
  assert(getCardText('绝影').detail.includes('受到【杀】造成的伤害后'),
    '装备点击说明使用差异化后的坐骑 detail（受伤摸牌）');

  console.log('\n[9] 终局结算浮层与打击感元素');
  renderPage('ResultOverlay(胜利)', React.createElement(ResultOverlay, {
    won: true, round: 7, onRestart: noop, onMenu: noop,
  }), ['胜利', '再来一局', '返回主菜单', '7']);

  renderPage('ResultOverlay(战败)', React.createElement(ResultOverlay, {
    won: false, round: 3, onRestart: noop, onMenu: noop, restarting: false,
  }), ['战败', '再来一局', '返回主菜单']);

  renderPage('PlayerArea(受击飘字)', React.createElement(PlayerArea, {
    player: enemy, isSelf: false, isCurrent: false, selectable: false,
    hit: true, damage: { playerId: enemy.id, num: 2, id: 'dmg-1' },
  }), ['2', 'hit', 'damage-pop']);

  console.log('\n[10] 重新开始(store 状态重置)');
  const store = useGameStore;
  const firstGame = store.getState().initGame();
  store.setState({ gameState: { status: 'finished', round: 9 }, logs: [{ message: 'old' }] });
  const secondGame = store.getState().initGame();
  const st = store.getState();
  assert(secondGame !== firstGame, '重开创建全新 Game 实例');
  assert(st.gameState === null && st.logs.length === 0, '重开清空对局状态');
  assert(st.pendingAction === null && st.effect === null, '重开清空挂起操作与特效');

  console.log('\n[11] 联机大厅');
  renderPage('OnlineLobby', React.createElement(OnlineLobby, { navigate: noop }),
    ['联机对战', '创建房间', '加入', '高级设置', '中继地址']);

  console.log('\n[12] 联机客户端的操作面板(纯数据，无本地引擎)');
  const remoteCards = [
    { id: 'c1', name: '杀', suit: 'spade', number: 7, numberDisplay: '7', type: 'basic' },
    { id: 'c2', name: '过河拆桥', suit: 'club', number: 3, numberDisplay: '3', type: 'trick' },
  ];
  const remoteTargets = [
    { id: 'p2', name: 'AI2', seatNum: 1 },
    { id: 'p3', name: 'AI3', seatNum: 2 },
  ];
  renderPage('ActionPanel(联机出牌)', React.createElement(ActionPanel, {
    action: {
      type: 'play',
      player: { id: 'p1', name: '你' },
      cards: remoteCards,
      shaTargets: remoteTargets,
      otherPlayers: remoteTargets,
      online: true,
    },
    onResolve: noop,
    selectedCards: [remoteCards[0]],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game: null,
  }), ['确认出牌', '结束出牌', 'AI2', '杀']);

  renderPage('ActionPanel(联机确认)', React.createElement(ActionPanel, {
    action: { type: 'confirm', message: '是否发动技能【英姿】？', online: true },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game: null,
  }), ['技能确认', '是否发动技能', '发动', '取消']);

  renderPage('ResultOverlay(联机等待房主)', React.createElement(ResultOverlay, {
    won: false, round: 4, onRestart: noop, onMenu: noop,
    canRestart: false, menuLabel: '离开房间',
  }), ['战败', '等待房主重开', '离开房间']);

  console.log('\n[13] 联机卡牌效果序列化(八卦阵判定/伤害/无懈/武器)');
  const armorEffect = serializeEffect({ type: 'armor', player: enemy, name: '八卦阵', success: false });
  assert(armorEffect.success === false, '八卦阵效果序列化保留 success=false（判定失败）');
  assert(armorEffect.playerId === enemy.id && armorEffect.name === '八卦阵', '八卦阵效果带玩家与名称');
  const damageEffect = serializeEffect({ type: 'damage', source: self, target: enemy, num: 2, nature: 'fire' });
  assert(damageEffect.sourceId === self.id && damageEffect.targetId === enemy.id, '伤害效果带来源/目标 id');
  assert(damageEffect.num === 2 && damageEffect.nature === 'fire', '伤害效果保留数值与属性');
  const wuxieEffect = serializeEffect({ type: 'wuxie', player: self, target: enemy, name: '无懈可击' });
  assert(wuxieEffect.type === 'wuxie' && wuxieEffect.name === '无懈可击', '无懈效果类型/名称可序列化');
  const weaponEffect = serializeEffect({ type: 'weapon', player: self, target: enemy, name: '寒冰剑' });
  assert(weaponEffect.type === 'weapon' && weaponEffect.targetId === enemy.id, '武器效果带目标 id');

  console.log('\n[14] 联机客户端提示路由与回执');
  const relayed = [];
  const originalRelay = net.relay;
  net.relay = (to, payload) => { relayed.push({ to, payload }); return true; };
  // 客户端回执统一包在 { kind: 'action', requestId, payload } 里
  const lastAction = () => {
    const m = relayed[relayed.length - 1];
    return m?.payload?.kind === 'action' ? m.payload : null;
  };
  store.getState().initNet();
  store.setState({ pendingAction: null });

  net.emit('relay', { kind: 'effect', effect: armorEffect });
  assert(store.getState().effect?.type === 'armor', '客户端收到 armor 效果消息');
  assert(store.getState().effect?.success === false, '客户端保留八卦阵判定失败结果');

  net.emit('relay', { kind: 'prompt', requestId: 'r-confirm', prompt: { type: 'confirm', message: '是否对 你 使用一张【桃】？' } });
  let pa = store.getState().pendingAction;
  assert(pa?.type === 'confirm' && /桃/.test(pa.message || ''), '确认请求路由为确认面板');
  store.getState().resolveAction(false);
  let last = lastAction();
  assert(last?.payload?.kind === 'confirm' && last.payload.yes === false && last.requestId === 'r-confirm', '确认回执发回房主且带 requestId');
  assert(store.getState().pendingAction === null, '确认后清理 pendingAction（不卡死）');

  const legalShan = { id: 'c-shan', name: '闪', suit: 'heart', number: 2, numberDisplay: '2', type: 'basic' };
  net.emit('relay', { kind: 'prompt', requestId: 'r-respond-1', prompt: { type: 'respond', player: { id: 'p1', name: '你', seatNum: 0 }, cards: [legalShan] } });
  pa = store.getState().pendingAction;
  assert(pa?.type === 'respond' && pa.cards.length === 1, '响应请求只下发合法响应牌');
  store.getState().resolveAction(pa.cards[0]);
  last = lastAction();
  assert(last?.payload?.kind === 'respond' && last.payload.cardId === 'c-shan', '使用响应牌回执携带 cardId');
  assert(store.getState().pendingAction === null, '响应后清理 pendingAction');

  // 无懈可击链：连续第二次询问必须替换挂起操作，且可再次放弃
  net.emit('relay', { kind: 'prompt', requestId: 'r-respond-2', prompt: { type: 'respond', player: { id: 'p2', name: '远端', seatNum: 1 }, cards: [] } });
  const pa2 = store.getState().pendingAction;
  assert(pa2?.type === 'respond' && pa2 !== pa, '无懈链第二次询问生成新的 pendingAction');
  assert(Array.isArray(pa2.cards) && pa2.cards.length === 0, '无合法响应牌时 cards 为空（面板可点不使用）');
  store.getState().resolveAction(null);
  last = lastAction();
  assert(last?.requestId === 'r-respond-2' && last.payload.cardId === null, '第二次放弃以空 cardId 回执');
  assert(store.getState().pendingAction === null, '连续响应后仍能清理 pendingAction');

  net.emit('relay', {
    kind: 'prompt', requestId: 'r-play-1',
    prompt: {
      type: 'play', player: { id: 'p2', name: '远端', seatNum: 1 }, cards: [],
      playableIds: ['c-sha'],
      targetsByCard: { 杀: [{ id: 'p1', name: '你', seatNum: 0 }, { id: 'p3', name: 'AI3', seatNum: 2 }] },
      activeSkills: [{ id: 'sk1', name: '制衡' }],
      weaponActions: [{ id: 'zhangba', name: '丈八蛇矛' }],
      fangtianReady: true,
    },
  });
  pa = store.getState().pendingAction;
  assert(pa?.type === 'play', '出牌请求路由为出牌面板');
  assert(pa.activeSkills?.[0]?.id === 'sk1', '远端出牌提示包含主动技能');
  assert(pa.weaponActions?.[0]?.id === 'zhangba', '远端出牌提示包含武器主动技');
  assert(pa.fangtianReady === true, '远端出牌提示包含方天画戟多目标标记');
  store.getState().resolveAction({ card: { id: 'c-sha', name: '杀' }, targets: [{ id: 'p1' }, { id: 'p3' }] });
  last = lastAction();
  assert(last?.payload?.kind === 'play' && last.payload.cardId === 'c-sha', '出牌回执携带 cardId');
  assert(JSON.stringify(last?.payload?.targetIds) === JSON.stringify(['p1', 'p3']), '方天画戟多目标回执携带 targetIds 数组');
  assert(store.getState().pendingAction === null, '出牌回执后清理 pendingAction');

  const emitPlayPrompt = (requestId) => net.emit('relay', {
    kind: 'prompt', requestId,
    prompt: {
      type: 'play', player: { id: 'p2', name: '远端', seatNum: 1 }, cards: [],
      playableIds: ['c-sha'], targetsByCard: {},
      activeSkills: [{ id: 'sk1', name: '制衡' }],
      weaponActions: [{ id: 'zhangba', name: '丈八蛇矛' }],
    },
  });
  emitPlayPrompt('r-play-skill');
  store.getState().resolveAction({ type: 'useSkill', skillId: 'sk1' });
  assert(lastAction()?.payload?.kind === 'useSkill', '主动技能回执发回房主');
  emitPlayPrompt('r-play-weapon');
  store.getState().resolveAction({ type: 'useWeapon', weapon: 'zhangba' });
  last = lastAction();
  assert(last?.payload?.kind === 'useWeapon' && last.payload.weaponId === 'zhangba', '武器主动技回执发回房主');

  net.emit('relay', {
    kind: 'prompt', requestId: 'r-select',
    prompt: {
      type: 'selectCards', player: { id: 'p2', name: '远端', seatNum: 1 },
      cards: [
        { id: 'c1', name: '杀', suit: 'spade', number: 7, type: 'basic' },
        { id: 'c2', name: '闪', suit: 'heart', number: 2, type: 'basic' },
      ],
      min: 1, max: 2, hint: '制衡：选择要弃置的牌',
    },
  });
  pa = store.getState().pendingAction;
  assert(pa?.type === 'selectCards' && pa.cards.length === 2, '主动技能选牌提示路由到客户端');
  store.getState().resolveAction(pa.cards.slice(0, 1));
  last = lastAction();
  assert(last?.payload?.kind === 'selectCards' && JSON.stringify(last.payload.cardIds) === JSON.stringify(['c1']), '选牌回执携带 cardIds');

  net.emit('relay', {
    kind: 'prompt', requestId: 'r-target',
    prompt: {
      type: 'chooseTarget', player: { id: 'p2', name: '远端', seatNum: 1 },
      candidates: [{ id: 'p1', name: '你', seatNum: 0 }], hint: '选择目标',
    },
  });
  pa = store.getState().pendingAction;
  assert(pa?.type === 'chooseTarget', '主动技能选目标提示路由到客户端');
  store.getState().resolveAction(pa.candidates[0]);
  last = lastAction();
  assert(last?.payload?.kind === 'chooseTarget' && last.payload.targetId === 'p1', '选目标回执携带 targetId');
  assert(store.getState().pendingAction === null, '选牌/选目标后清理 pendingAction');

  console.log('\n[15] 重开/退出时安全放行挂起操作（不卡死旧对局）');
  const resolved = [];
  const fakeGame = { ui: {}, status: 'running', players: [] };
  store.setState({ game: fakeGame, pendingAction: { type: 'chooseTarget', resolve: (v) => resolved.push({ type: 'chooseTarget', v }) } });
  store.getState().initGame();
  assert(resolved[0]?.v === null, '选目标挂起操作以 null 放行（不再误传 endPlay 对象）');
  store.setState({ game: fakeGame, pendingAction: { type: 'confirm', resolve: (v) => resolved.push({ type: 'confirm', v }) } });
  store.getState().initGame();
  assert(resolved[1]?.v === false, '确认挂起操作以 false 放行');
  store.setState({ game: fakeGame, pendingAction: { type: 'selectCards', resolve: (v) => resolved.push({ type: 'selectCards', v }) } });
  store.getState().initGame();
  assert(Array.isArray(resolved[2]?.v) && resolved[2].v.length === 0, '选牌挂起操作以空数组放行');
  assert(store.getState().pendingAction === null, '重开后清空挂起操作');

  console.log('\n[16] 响应面板无牌提示 / 方天画戟逐目标勾选');
  renderPage('ActionPanel(无合法响应牌)', React.createElement(ActionPanel, {
    action: { type: 'respond', player: { id: 'p2', name: '远端', seatNum: 1 }, cards: [] },
    onResolve: noop,
    selectedCards: [],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game: null,
  }), ['响应请求', '没有可用于响应的手牌', '不使用', 'touch-action: pan-y']);

  let picked = toggleFangtianTarget([], { id: 't1', name: 'A' });
  picked = toggleFangtianTarget(picked, { id: 't2', name: 'B' });
  picked = toggleFangtianTarget(picked, { id: 't3', name: 'C' });
  assert(picked.length === 3, '方天画戟可逐个勾选 3 名目标');
  assert(toggleFangtianTarget(picked, { id: 't4', name: 'D' }).length === 3, '第 4 名目标被拒绝（最多 3）');
  assert(toggleFangtianTarget(picked, { id: 't2', name: 'B' }).length === 2, '再次点击已选目标可取消');

  renderPage('ActionPanel(方天画戟逐目标)', React.createElement(ActionPanel, {
    action: {
      type: 'play',
      player: self,
      playableIds: [sha.id],
      targetsByCard: { 杀: [enemy, { id: 'p9', name: 'AI9' }] },
      fangtianReady: true,
    },
    onResolve: noop,
    selectedCards: [sha],
    setSelectedCards: noop,
    selectedTarget: null,
    setSelectedTarget: noop,
    game,
  }), ['方天画戟 · 出杀', '逐个点选至多 3 名目标', '已选', '确认出牌']);

  console.log('\n[17] 联机房主权威 + 模拟远端真人全流程');
  relayed.length = 0;
  store.setState({
    online: {
      active: false, connecting: false, connected: true, isHost: true,
      roomCode: 'TEST1', seat: 0,
      members: [{ seat: 0, name: '房主' }, { seat: 1, name: '远端真人' }],
      serverUrl: '', name: '房主', error: null, notice: null, lanIps: [],
    },
    pendingAction: null,
    gameState: null,
    logs: [],
  });

  const answered = new Set();
  const remotePrompts = [];
  const pickCard = (p, name) => (p.cards || []).find(c => c.name === name && (p.playableIds || []).includes(c.id));
  const pickTarget = (p, name) => (p.targetsByCard?.[name] || [])[0] || null;

  const simTick = setInterval(() => {
    // 1) 模拟远端真人：逐条响应房主下发的提示
    for (const m of relayed) {
      const msg = m.payload;
      if (!msg || msg.kind !== 'prompt' || answered.has(msg.requestId)) continue;
      answered.add(msg.requestId);
      const p = msg.prompt || {};
      remotePrompts.push(p);
      let ans = null;
      if (p.type === 'play') {
        const shaCard = pickCard(p, '杀');
        const shaTarget = pickTarget(p, '杀');
        const duelCard = pickCard(p, '决斗');
        const duelTarget = pickTarget(p, '决斗');
        const aoeCard = pickCard(p, '南蛮入侵') || pickCard(p, '万箭齐发') || pickCard(p, '无中生有');
        if (shaCard && shaTarget) ans = { kind: 'play', cardId: shaCard.id, targetIds: [shaTarget.id] };
        else if (duelCard && duelTarget) ans = { kind: 'play', cardId: duelCard.id, targetIds: [duelTarget.id] };
        else if (aoeCard) ans = { kind: 'play', cardId: aoeCard.id, targetIds: [] };
        else ans = { kind: 'endPlay' };
      } else if (p.type === 'discard') {
        ans = { kind: 'discard', cardIds: (p.cards || []).slice(0, p.count || 0).map(c => c.id) };
      } else if (p.type === 'respond') {
        ans = { kind: 'respond', cardId: null };
      } else if (p.type === 'confirm') {
        ans = { kind: 'confirm', yes: false };
      } else if (p.type === 'selectCards') {
        ans = { kind: 'selectCards', cardIds: (p.cards || []).slice(0, Math.max(1, p.min || 1)).map(c => c.id) };
      } else if (p.type === 'chooseTarget') {
        ans = { kind: 'chooseTarget', targetId: (p.candidates || [])[0]?.id || null };
      }
      net.emit('relay', { kind: 'action', requestId: msg.requestId, payload: ans });
    }
    // 2) 房主本人操作：尽量进攻，加快对局结束
    const pa = store.getState().pendingAction;
    if (!pa || !pa.online) return;
    const gameNow = store.getState().game;
    const canUse = (c) => (gameNow?.canPlayCard ? gameNow.canPlayCard(pa.player, c) : true);
    if (pa.type === 'play') {
      const hand = pa.player?.handCards || [];
      const shaCard = hand.find(c => c.name === '杀' && canUse(c));
      const shaTarget = (pa.shaTargets || [])[0];
      const duelCard = hand.find(c => c.name === '决斗' && canUse(c));
      const duelTarget = (pa.juedouTargets || [])[0];
      const jiuCard = hand.find(c => c.name === '酒' && canUse(c));
      if (shaCard && shaTarget) store.getState().resolveAction({ card: shaCard, targets: [shaTarget] });
      else if (duelCard && duelTarget) store.getState().resolveAction({ card: duelCard, targets: [duelTarget] });
      else if (jiuCard) store.getState().resolveAction({ card: jiuCard, targets: [] });
      else store.getState().resolveAction({ type: 'endPlay' });
    } else if (pa.type === 'discard') {
      store.getState().resolveAction((pa.player?.handCards || []).slice(0, pa.count || 0));
    } else if (pa.type === 'respond') {
      store.getState().resolveAction(null);
    } else if (pa.type === 'confirm') {
      store.getState().resolveAction(false);
    } else if (pa.type === 'selectCards') {
      store.getState().resolveAction((pa.cards || []).slice(0, Math.max(1, pa.min || 1)));
    } else if (pa.type === 'chooseTarget') {
      store.getState().resolveAction((pa.candidates || [])[0] || null);
    }
  }, 5);

  const hostStarted = await store.getState().hostStartOnline(3);
  assert(hostStarted === true, '联机房主对局启动(房主 + 远端真人 + AI)');

  let finished = false;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 40000) {
    if (store.getState().gameState?.status === 'finished') {
      finished = true;
      break;
    }
    await new Promise(r => setTimeout(r, 25));
  }
  clearInterval(simTick);
  await new Promise(r => setTimeout(r, 80));

  const finalState = store.getState().gameState;
  assert(finished, '联机对局可正常结束（远端确认/响应/出牌均被回执）', `round=${finalState?.round} prompts=${remotePrompts.length}`);
  assert(remotePrompts.length > 0, '远端真人收到操作提示');
  assert(remotePrompts.some(p => p.type === 'play'), '远端真人收到出牌提示');
  assert(relayed.every(m => m.to === 1), '联机消息只发给远端真人座位（AI 座位不弹提示）');

  const stateMsgs = relayed.filter(m => m.payload?.kind === 'state');
  assert(stateMsgs.length > 0, '客户端收到状态同步');
  const lastState = stateMsgs[stateMsgs.length - 1].payload.state;
  const seat1 = lastState.players.find(p => p.seatNum === 1);
  const seat0 = lastState.players.find(p => p.seatNum === 0);
  assert(Array.isArray(seat1?.handCards), '状态同步包含自己的手牌明细');
  assert(!!seat0 && seat0.handCards === undefined, '状态同步不泄露其他玩家手牌');

  const effectMsgs = relayed.filter(m => m.payload?.kind === 'effect');
  assert(effectMsgs.some(m => m.payload.effect.type === 'draw'), '客户端收到摸牌动画效果');
  assert(effectMsgs.every(m => typeof m.payload.effect.type === 'string'), '所有效果消息带 type');
  const armorMsgs = effectMsgs.filter(m => m.payload.effect.type === 'armor');
  assert(armorMsgs.every(m => Object.prototype.hasOwnProperty.call(m.payload.effect, 'success')), '八卦阵效果携带判定结果字段');
  assert(store.getState().pendingAction === null, '对局结束不残留挂起操作');

  store.getState().leaveOnline();
  net.relay = originalRelay;
  assert(store.getState().online.roomCode === null, '离开房间后清理联机状态');

  console.log('\n[18] 手牌区提示文案随挂起操作切换');
  assert(handHintFor(null).includes('双击复位'), '无挂起操作时提示整理/说明手势');
  assert(handHintFor({ type: 'play' }).includes('确认出牌'), '出牌阶段提示确认出牌');
  assert(handHintFor({ type: 'discard', count: 2 }).includes('2 张'), '弃牌阶段提示弃牌张数');
  assert(handHintFor({ type: 'respond' }).includes('不使用'), '响应阶段提示可以不使用');
  assert(handHintFor({ type: 'confirm' }).includes('使用桃'), '确认阶段同时覆盖技能发动与濒死求桃');
  assert(handHintFor({ type: 'selectCards' }).includes('完成选择'), '主动技能选牌阶段有通用提示');

  console.log('\n[19] 布局配置：预设 / 缩放裁剪 / CSS 变量');
  const dft = defaultLayout();
  assert(dft.preset === 'mingsha' && dft.logCollapsed === true, '默认预设为名将杀式且日志默认收起');
  assert(dft.logPosition === 'right' && dft.handScale === 1.05, '名将杀式默认日志右侧 / 手牌缩放 1.05');
  assert(dft.theme === 'ink' && THEME_OPTIONS.length === 3, '默认界面风格为墨玉鎏金，共三套可选风格');
  assert(THEME_OPTIONS.map(t => t.id).join(',') === 'ink,modern,tabletop',
    '三套风格 ID 固定为 ink / modern / tabletop');
  assert(themeOption({ theme: 'modern' }).name === '青灰极简'
    && themeOption({ theme: 'unknown' }).id === 'ink', '风格解析合法值并回退墨玉鎏金');
  assert(normalizeLayout({ theme: 'nope' }).theme === 'ink', '非法风格回落到墨玉鎏金');
  assert(layoutData(updateLayout(dft, { theme: 'tabletop' }))['data-theme'] === 'tabletop',
    'data-theme 由布局配置生成');
  assert(updateLayout(applyPreset('classic'), { theme: 'modern' }).theme === 'modern',
    '切换布局预设时保留玩家选择的界面风格');
  const classicPreset = applyPreset('classic');
  assert(classicPreset.preset === 'classic' && classicPreset.handScale === 1
    && classicPreset.logCollapsed === false, '经典式 = 原布局参数（1 倍手牌、日志展开）');
  assert(applyPreset('classic') !== PRESET_SETTINGS.classic, 'applyPreset 返回副本，避免改坏预设常量');
  const compactPreset = applyPreset('compact');
  assert(compactPreset.logPosition === 'hidden' && compactPreset.opponentScale === 'small'
    && compactPreset.showBanner === false, '紧凑式参数：日志隐藏 / 对手小卡 / 关横幅');
  assert(clampHandScale(5) === HAND_SCALE_MAX && clampHandScale(0.1) === HAND_SCALE_MIN,
    '手牌缩放裁剪到 0.85~1.3');
  assert(clampHandScale('bad') === 1, '非法手牌缩放回落到 1');
  assert(normalizeLayout({ preset: 'not-exist' }).preset === 'mingsha', '非法预设回落名将杀式');
  const customLayout = updateLayout(dft, { handScale: 1.2, logPosition: 'bottom' });
  assert(customLayout.preset === 'mingsha' && customLayout.handScale === 1.2
    && customLayout.logPosition === 'bottom', '面板修改保留预设并即时合并');
  const classicData = layoutData(applyPreset('classic'));
  assert(classicData['data-layout'] === 'classic' && classicData['data-log-position'] === 'right',
    'data-layout / data-log-position 由预设生成');
  const compactStyle = layoutStyle({ ...applyPreset('compact'), opponentScale: 'large' });
  assert(compactStyle['--hand-scale'] === '0.9' && compactStyle['--opponent-scale'] === '1.18',
    'CSS 变量包含手牌 / 对手缩放');
  assert(compactStyle['--hand-gap'] === '4px' && compactStyle['--hand-overlap'] === '-14px',
    '紧凑间距产生负重叠变量');
  assert(shouldOpenLog(applyPreset('mingsha')) === false
    && shouldOpenLog(applyPreset('classic')) === true, '日志默认开合随预设');
  assert(defaultLayout().showDistance === true && applyPreset('classic').showDistance === true
    && applyPreset('compact').showDistance === true, '三套预设默认显示距离提示');
  assert(normalizeLayout({ showDistance: false }).showDistance === false,
    'showDistance 可被关闭');
  assert(normalizeLayout({ showDistance: 'bad' }).showDistance === true,
    '非法 showDistance 归一化为默认 true');

  console.log('\n[20] 布局 localStorage 持久化');
  const memStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(saveLayout({ ...applyPreset('classic'), handScale: 1.15, theme: 'tabletop' }, memStorage) === true,
    '布局写入 localStorage 成功');
  const loadedLayout = loadLayout(memStorage);
  assert(loadedLayout.preset === 'classic' && loadedLayout.handScale === 1.15,
    '刷新后从 localStorage 恢复预设与手牌缩放');
  assert(loadedLayout.theme === 'tabletop', '刷新后恢复玩家选择的界面风格');
  assert(memStorage.getItem(LAYOUT_STORAGE_KEY).includes('"handScale":1.15')
    && memStorage.getItem(LAYOUT_STORAGE_KEY).includes('"theme":"tabletop"'),
  '持久化键 cgm_layout 内容可读');
  saveLayout({ ...applyPreset('mingsha'), showDistance: false }, memStorage);
  assert(loadLayout(memStorage).showDistance === false, '关闭距离提示后刷新仍保持关闭');
  memStorage.setItem(LAYOUT_STORAGE_KEY, '{损坏的json');
  assert(loadLayout(memStorage).preset === 'mingsha', '损坏的存储回落到默认布局');
  memStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ preset: 'classic', handGap: 'nope', handScale: 9 }));
  const repairedLayout = loadLayout(memStorage);
  assert(repairedLayout.handGap === 'normal' && repairedLayout.handScale === 1.3,
    '非法字段归一化（间距回默认、缩放裁剪）');
  clearLayout(memStorage);
  assert(loadLayout(memStorage).preset === 'mingsha', '清除存储后恢复默认布局');

  console.log('\n[21] 布局设置面板');
  renderPage('LayoutSettings(名将杀式)', React.createElement(LayoutSettings, {
    layout: defaultLayout(), onChange: noop, onPreset: noop, onReset: noop, onClose: noop,
  }), ['布局设置', '界面风格', '墨玉鎏金', '青灰极简', '暖木典藏',
    '布局预设', '名将杀式', '经典式', '紧凑式', '手牌缩放', '105%',
    '手牌间距/重叠', '对手卡尺寸', '日志位置', '右侧', '底部', '隐藏',
    '回合横幅', '飘字/飞牌提示', '显示距离提示', '恢复默认布局', '关闭', '细状态条']);
  renderPage('LayoutSettings(经典式)', React.createElement(LayoutSettings, {
    layout: applyPreset('classic'), onChange: noop, onPreset: noop, onReset: noop, onClose: noop,
  }), ['经典式', '100%', '保留原布局']);
  renderPage('LayoutSettings(紧凑式)', React.createElement(LayoutSettings, {
    layout: applyPreset('compact'), onChange: noop, onPreset: noop, onReset: noop, onClose: noop,
  }), ['紧凑式', '90%', '适合小屏']);
  renderPage('LayoutSettings(青灰极简)', React.createElement(LayoutSettings, {
    layout: updateLayout(defaultLayout(), { theme: 'modern' }), onChange: noop, onPreset: noop, onReset: noop, onClose: noop,
  }), ['青灰极简', '冷青灰面板', 'theme-card is-active']);

  console.log('\n[22] 对局桌面布局渲染（data-layout / CSS 变量 / 日志抽屉）');
  const layoutPlayers = [
    {
      id: 'lp1', name: '你', seatNum: 0, isAI: false, hp: 3, maxHp: 4,
      handCards: [
        { id: 'lh1', name: '杀', suit: 'spade', number: 7, numberDisplay: '7', type: 'basic' },
        { id: 'lh2', name: '闪', suit: 'heart', number: 2, numberDisplay: '2', type: 'basic' },
      ],
      equips: {}, judgeCards: [], skills: [], status: 'alive',
    },
    {
      id: 'lp2', name: '对手甲', seatNum: 1, isAI: true, hp: 2, maxHp: 4, handCardCount: 3,
      handCards: [], equips: {}, judgeCards: [{ id: 'lj1', name: '乐不思蜀' }], skills: [], status: 'alive',
    },
  ];
  const previewState = {
    status: 'running', round: 2, currentPhase: 'play',
    currentPlayer: { id: 'lp2', name: '对手甲' },
    players: layoutPlayers,
    deckInfo: { remaining: 42, total: 108, discarded: 5, seed: 123456 },
    logs: [{ message: '旧日志' }],
  };
  const previewOnline = { active: false, seat: 0, isHost: false, roomCode: null };
  const previewBase = {
    gameState: previewState, game: null, pendingAction: null,
    effect: null, logs: [{ message: '旧日志' }], online: previewOnline,
  };
  const renderBoard = (initialLayout) => renderToString(React.createElement(GameBoard, {
    navigate: noop, preview: previewBase, initialLayout,
  }));

  const classicHtml = renderBoard(applyPreset('classic'));
  assert(classicHtml.includes('data-layout="classic"'), '经典式渲染 data-layout="classic"');
  assert(classicHtml.includes('data-theme="ink"'), '经典式默认渲染 data-theme="ink"');
  const modernHtml = renderBoard(updateLayout(defaultLayout(), { theme: 'modern' }));
  assert(modernHtml.includes('data-theme="modern"') && modernHtml.includes('--hand-scale:1.05'),
    '切换青灰极简后 data-theme 与布局变量同时生效');
  assert(classicHtml.includes('--hand-scale:1') && classicHtml.includes('--opponent-scale:1'),
    '经典式 CSS 变量为 1（原布局回归）');
  assert(classicHtml.includes('你的手牌') && classicHtml.includes('手牌 2'),
    '底部手牌区显示「手牌 N」');
  assert(classicHtml.includes('对局日志') && classicHtml.includes('旧日志'),
    '经典式日志默认展开在右侧');
  assert(!classicHtml.includes('判定区'), '经典式不新增判定行（严格回归原布局）');
  assert(classicHtml.includes('data-icon="layout"'), '顶栏提供布局齿轮入口（layout 图标）');

  const mingshaHtml = renderBoard(defaultLayout());
  // React SSR 会把 <style> 文本里的引号转义为 &quot;，比较选择器前先还原
  const mingshaCss = mingshaHtml.replace(/&quot;/g, '"');
  assert(mingshaHtml.includes('data-layout="mingsha"'), '名将杀式渲染 data-layout="mingsha"');
  assert(mingshaHtml.includes('--hand-scale:1.05'), '名将杀式手牌缩放变量 1.05');
  assert(mingshaHtml.includes('class="log-strip"'), '名将杀式日志默认收起为右侧窄条');
  assert(!mingshaHtml.includes('class="log-panel'), '名将杀式日志默认不展开');
  assert(mingshaHtml.includes('判定区') && mingshaHtml.includes('对手甲'), '名将杀式中央判定展示区含对手判定牌');
  assert(mingshaHtml.includes('class="other-players opponents-1"'), '对手区按人数生成密度 class');
  assert(mingshaCss.includes('.game-board[data-layout="mingsha"] .self-zone')
    && mingshaCss.includes('row-reverse'), '名将杀式自己武将卡在左、手牌区在右');
  assert(mingshaCss.includes('@keyframes layoutGoldBreath')
    && mingshaCss.includes('.game-board[data-layout="mingsha"] .other-players .player-area.current'),
  '当前行动者金色呼吸高亮样式存在');
  assert(mingshaCss.includes('@media (max-width: 720px)')
    && mingshaCss.includes('.game-board[data-layout="mingsha"] .other-players'),
  '手机断点包含名将杀式布局规则');

  const bottomHtml = renderBoard(updateLayout(defaultLayout(), { logPosition: 'bottom', logCollapsed: false }));
  assert(bottomHtml.includes('data-log-position="bottom"') && bottomHtml.includes('log-panel-bottom'),
    '日志可切换到底部抽屉');
  const hiddenHtml = renderBoard(updateLayout(defaultLayout(), { logPosition: 'hidden', logCollapsed: false }));
  assert(hiddenHtml.includes('data-log-position="hidden"')
    && !hiddenHtml.includes('class="log-strip"') && !hiddenHtml.includes('class="log-panel'),
  '日志位置设为隐藏时无日志入口');
  const scaledHtml = renderBoard(updateLayout(defaultLayout(), { handScale: 1.25, opponentScale: 'large' }));
  assert(scaledHtml.includes('--hand-scale:1.25') && scaledHtml.includes('--opponent-scale:1.18'),
    '手牌 / 对手缩放即时反映到 CSS 变量');
  const compactHtml = renderBoard(applyPreset('compact'));
  assert(compactHtml.includes('data-layout="compact"') && compactHtml.includes('--hand-scale:0.9'),
    '紧凑式渲染 data-layout="compact" 与更小手牌');
  assert(compactHtml.includes('--hand-gap:4px') && compactHtml.includes('--hand-overlap:-14px'),
    '紧凑式默认紧凑间距 / 重叠');

  const appCss = readFileSync('src/App.css', 'utf8');
  assert(appCss.includes('--hand-scale: 1') && appCss.includes('--hand-gap: 8px')
    && appCss.includes('--hand-overlap: 0px') && appCss.includes('--opponent-scale: 1'),
  'App.css 提供布局 CSS 变量默认值');

  console.log('\n[23] 一键整理：排序模式轮换 / FLIP / 音效');
  const sortCards = [
    { id: 's1', name: '桃', suit: 'heart', number: 5, type: 'basic' },
    { id: 's2', name: '杀', suit: 'spade', number: 7, type: 'basic' },
    { id: 's3', name: '闪', suit: 'diamond', number: 2, type: 'basic' },
    { id: 's4', name: '无中生有', suit: 'club', number: 3, type: 'trick' },
    { id: 's5', name: '决斗', suit: 'club', number: 1, type: 'trick' },
    { id: 's6', name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip' },
    { id: 's7', name: '乐不思蜀', suit: 'heart', number: 6, type: 'delay_trick' },
  ];
  const sortIds = (list) => list.map(c => c.id).join(',');
  const typeSorted = sortHandCards(sortCards, 'type');
  assert(sortIds(typeSorted).split(',').slice(0, 3).join(',') === 's3,s1,s2',
    '类型→点数：基本牌按点数升序', sortIds(typeSorted));
  assert(sortIds(typeSorted) === 's3,s1,s2,s5,s4,s7,s6',
    '类型→点数：锦囊/延时锦囊/装备依次靠后', sortIds(typeSorted));
  const suitSorted = sortHandCards(sortCards, 'suit');
  assert(sortIds(suitSorted) === 's6,s2,s5,s4,s1,s7,s3',
    '花色→点数：黑桃→梅花→红桃→方块，同花色按点数', sortIds(suitSorted));
  const numberSorted = sortHandCards(sortCards, 'number');
  assert(sortIds(numberSorted) === 's5,s3,s4,s6,s1,s7,s2',
    '点数→花色：同点数按花色', sortIds(numberSorted));
  const expectedNameOrder = [...sortCards]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.name.localeCompare(b.name));
  assert(sortIds(sortHandCards(sortCards, 'name')) === sortIds(expectedNameOrder),
    '名称：中文 localeCompare 排序');
  assert(sortIds(sortCards) === 's1,s2,s3,s4,s5,s6,s7', '排序纯函数不改动入参数组');
  assert(nextHandSortMode('type') === 'suit' && nextHandSortMode('suit') === 'number'
    && nextHandSortMode('number') === 'name' && nextHandSortMode('name') === 'type',
  '排序模式轮换：类型→花色→点数→名称→类型');
  assert(nextHandSortMode('bad') === 'suit' && normalizeHandSortMode('x') === 'type',
    '非法模式回退默认类型');
  assert(handSortLabel('type') === '类型' && handSortLabel('suit') === '花色'
    && handSortLabel('number') === '点数' && handSortLabel('name') === '名称', '模式中文徽标映射');

  const sortStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(saveHandSortMode('name', sortStorage) === true, '排序模式写入 localStorage');
  assert(sortStorage.getItem(HAND_SORT_STORAGE_KEY) === 'name', '持久化键 cgm_hand_sort');
  assert(loadHandSortMode(sortStorage) === 'name', '刷新后恢复排序模式');
  sortStorage.setItem(HAND_SORT_STORAGE_KEY, 'nope');
  assert(loadHandSortMode(sortStorage) === 'type', '非法持久化值回退默认类型');

  const sfxKeys = SFX_SLOTS.map(s => s.key);
  const legacySfxKeys = ['sfx:click', 'sfx:card', 'sfx:sha', 'sfx:shan', 'sfx:tao',
    'sfx:trick', 'sfx:equip', 'sfx:damage', 'sfx:draw', 'sfx:turn', 'sfx:win', 'sfx:lose'];
  assert(sfxKeys.includes('sfx:shuffle'), '音效槽位新增 sfx:shuffle');
  assert(legacySfxKeys.every(k => sfxKeys.includes(k)), '原有 12 类音效槽位保持完整');
  const audioSrc = readFileSync('src/audio/audioManager.js', 'utf8');
  assert(audioSrc.includes("name === 'shuffle'") && audioSrc.includes('createBiquadFilter')
    && audioSrc.includes('createBuffer'), 'shuffle 为合成音效（噪声 + 带通扫频）');

  const handSrc = readFileSync('src/components/GameBoard/HandZone.jsx', 'utf8');
  assert(handSrc.includes('getBoundingClientRect') && handSrc.includes('useLayoutEffect')
    && handSrc.includes('FLIP'), '组件实现 FLIP（先记录 rect，layout effect 计算位移）');
  assert(handSrc.includes('matchMedia') && handSrc.includes('prefers-reduced-motion'),
    '组件尊重 prefers-reduced-motion');
  assert(handSrc.includes("audio.playSfx('shuffle')"), '整理时播放 shuffle 音效');
  assert(handSrc.includes('HAND_FLIP_STAGGER') && handSrc.includes('cubic-bezier')
    && handSrc.includes('scale(1.06)'), 'FLIP 使用 stagger + 轻微缩放 + 回弹缓动');
  assert(handSrc.includes('disabled={cards.length === 0 || animating}') && handSrc.includes('aria-busy'),
    '整理动画期间禁用按钮并标记 busy');
  const appCssSort = readFileSync('src/App.css', 'utf8');
  assert(appCssSort.includes('.hand-sort-badge') && appCssSort.includes('handShineSweep'),
    'App.css 包含排序徽标与整理扫光 keyframes');
  assert(appCssSort.includes('prefers-reduced-motion') && appCssSort.includes('.hand-shine'),
    'App.css 包含减少动态效果处理');

  console.log('\n[24] 队友 / 阵营设置（2v2·3v3）与牌桌标识');
  // 1) 组队纯函数与座位标签
  assert(teamPlayerCount('ffa') === null && teamPlayerCount('2v2') === 4 && teamPlayerCount('3v3') === 6,
    '组队模式固定人数：2v2=4 / 3v3=6');
  assert(seatTeam(0, '2v2') === 0 && seatTeam(1, '2v2') === 1
    && seatTeam(2, '2v2') === 0 && seatTeam(3, '2v2') === 1, '2v2 按座位奇偶分队友/敌方');
  assert(seatTeam(0, '3v3') === 0 && seatTeam(4, '3v3') === 0
    && seatTeam(5, '3v3') === 1 && seatTeam(0, 'ffa') === null, '3v3 0/2/4 为我方，ffa 无队伍');
  assert(seatLabel(0, '2v2') === '你' && seatLabel(1, '2v2') === '敌人1'
    && seatLabel(2, '2v2') === '队友1' && seatLabel(3, '2v2') === '敌人2',
  '2v2 座位标签：你 / 队友1 / 敌人1 / 敌人2');
  assert(seatLabel(0, '3v3') === '你' && seatLabel(2, '3v3') === '队友1'
    && seatLabel(4, '3v3') === '队友2' && seatLabel(5, '3v3') === '敌人3', '3v3 座位标签');
  assert(seatLabel(1, 'ffa') === 'AI1' && seatLabel(0, 'ffa') === '你', '自由混战沿用原座位命名');
  const preview2v2 = teamPreview('2v2');
  assert(preview2v2 && preview2v2.ally.join(',') === '你,队友1'
    && preview2v2.enemy.join(',') === '敌人1,敌人2', '2v2 分组预览我方/敌方名单');
  const preview3v3 = teamPreview('3v3');
  assert(preview3v3.ally.join(',') === '你,队友1,队友2'
    && preview3v3.enemy.join(',') === '敌人1,敌人2,敌人3', '3v3 分组预览');
  assert(teamPreview('ffa') === null, '自由混战无分组预览');
  assert(normalizeTeamMode('bad') === 'ffa' && isTeamMode('2v2') && !isTeamMode('ffa'),
    '组队模式归一化与判定');
  const teamCfgs = buildTeamConfigs(4, '2v2', { 1: 'cls_caocao' });
  assert(teamCfgs.length === 4 && teamCfgs.map(c => c.team).join(',') === '0,1,0,1',
    'configs 携带 team：0,1,0,1');
  assert(teamCfgs[0].name === '你' && teamCfgs[2].name === '队友1'
    && teamCfgs[1].characterId === 'cls_caocao', 'configs 名称与武将选择沿用');
  assert(buildTeamConfigs(3, 'ffa').every(c => c.team === null), '自由混战 configs.team 为 null');

  // 2) 牌桌队伍标签 / 胜负文案
  assert(teamChipFor({ seatNum: 2, team: 0 }, 0, '2v2') === '我方'
    && teamChipFor({ seatNum: 1, team: 1 }, 0, '2v2') === '敌方', '同队=我方 / 异队=敌方');
  assert(teamChipFor({ seatNum: 2 }, 0, '2v2') === '我方'
    && teamChipFor({ seatNum: 1 }, 0, '2v2') === '敌方', '无 team 字段时按座位兜底');
  assert(teamChipFor({ seatNum: 1, team: 1 }, 0, 'ffa') === null, '自由混战不显示队伍标签');
  assert(teamClassFor('我方') === 'team-ally' && teamClassFor('敌方') === 'team-enemy'
    && teamClassFor(null) === '', '队伍样式类映射');
  const outcomeWin = computeTeamOutcome(
    [{ status: 'alive', team: 0, seatNum: 0 }, { status: 'dead', team: 1, seatNum: 1 }],
    0, '2v2', { status: 'alive' });
  assert(outcomeWin.won === true && outcomeWin.subtitle === '你与队友获胜', '组队胜利文案');
  const outcomeLose = computeTeamOutcome(
    [{ status: 'dead', team: 0, seatNum: 0 }, { status: 'alive', team: 1, seatNum: 1 }],
    0, '2v2', { status: 'dead' });
  assert(outcomeLose.won === false && outcomeLose.subtitle === '你的队伍失败', '组队失败文案');
  const outcomeFfa = computeTeamOutcome([], 0, 'ffa', { status: 'alive' });
  assert(outcomeFfa.won === true && outcomeFfa.subtitle === null, '自由混战保持原胜负且无组队副标题');

  // 3) 默认组队模式持久化
  const teamStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(readDefaultTeamMode(teamStorage) === 'ffa', '默认组队模式初始为自由混战');
  teamStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ playerCount: 5, teamMode: '2v2' }));
  assert(readDefaultTeamMode(teamStorage) === '2v2', '读取设置页保存的默认组队模式');
  teamStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ teamMode: 'bad' }));
  assert(readDefaultTeamMode(teamStorage) === 'ffa', '非法默认组队模式回退 ffa');
  teamStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ playerCount: 5 }));
  assert(saveDefaultTeamMode('3v3', teamStorage) === true, '保存默认组队模式');
  const savedTeamCfg = JSON.parse(teamStorage.getItem(GAME_CONFIG_STORAGE_KEY));
  assert(savedTeamCfg.teamMode === '3v3' && savedTeamCfg.playerCount === 5,
    '保存时合并不覆盖其它游戏设置');

  // 4) SetupPanel SSR：组队模式/分组预览/座位标签
  renderPage('SetupPanel(2v2)', React.createElement(SetupPanel, {
    characters: [], skills: [], onStart: noop, initialTeamMode: '2v2',
  }), ['队友 / 阵营设置', '组队模式', '2v2 组队', '3v3 组队', '自由混战',
    '我方', '敌方', '你、队友1', '敌人1、敌人2', '组队模式固定', '队友1', '敌人2']);
  renderPage('SetupPanel(3v3)', React.createElement(SetupPanel, {
    characters: [], skills: [], onStart: noop, initialTeamMode: '3v3',
  }), ['3v3 组队', '你、队友1、队友2', '敌人1、敌人2、敌人3',
    '组队模式固定', '队友2', '敌人3']);
  const ffaSetupHtml = renderToString(React.createElement(SetupPanel, {
    characters: [], skills: [], onStart: noop, initialTeamMode: 'ffa',
  }));
  assert(!ffaSetupHtml.includes('class="team-preview"')
    && !ffaSetupHtml.includes('class="team-preview-group ally"'),
  '自由混战选将面板不显示分组预览');

  // 5) PlayerArea / SelfCharacterCard 组队 chip
  const allyPlayer = {
    id: 'ally1', name: '队友甲', seatNum: 2, team: 0, isAI: true, hp: 4, maxHp: 4,
    handCards: [], handCardCount: 0, equips: {}, judgeCards: [], skills: [], status: 'alive',
  };
  const enemyPlayer = {
    id: 'enemy1', name: '敌人乙', seatNum: 1, team: 1, isAI: true, hp: 4, maxHp: 4,
    handCards: [], handCardCount: 0, equips: {}, judgeCards: [], skills: [], status: 'alive',
  };
  renderPage('PlayerArea(我方队友)', React.createElement(PlayerArea, {
    player: allyPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: '2v2', selfSeatNum: 0,
  }), ['我方', 'team-ally', '队友甲']);
  renderPage('PlayerArea(敌方)', React.createElement(PlayerArea, {
    player: enemyPlayer, isSelf: false, isCurrent: true, selectable: false,
    teamMode: '2v2', selfSeatNum: 0,
  }), ['敌方', 'team-enemy', '敌人乙']);
  const ffaPlayerHtml = renderToString(React.createElement(PlayerArea, {
    player: allyPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', selfSeatNum: 0,
  }));
  assert(!ffaPlayerHtml.includes('team-chip') && !ffaPlayerHtml.includes('team-ally'),
    '自由混战 PlayerArea 不显示队伍标签与描边');
  renderPage('SelfCharacterCard(组队我方)', React.createElement(SelfCharacterCard, {
    player: { ...allyPlayer, name: '你', seatNum: 0 }, teamMode: '2v2',
  }), ['我方', 'team-ally']);
  const ffaSelfHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: { ...allyPlayer, name: '你', seatNum: 0 }, teamMode: 'ffa',
  }));
  assert(!ffaSelfHtml.includes('team-chip') && !ffaSelfHtml.includes('team-ally'),
    '自由混战自己武将卡不显示队伍标签');
  renderPage('ResultOverlay(组队胜利)', React.createElement(ResultOverlay, {
    won: true, round: 6, onRestart: noop, onMenu: noop, subtitle: '你与队友获胜',
  }), ['胜利', '你与队友获胜', '再来一局', '返回主菜单']);
  renderPage('ResultOverlay(组队失败)', React.createElement(ResultOverlay, {
    won: false, round: 6, onRestart: noop, onMenu: noop, subtitle: '你的队伍失败',
  }), ['战败', '你的队伍失败', '返回主菜单']);

  // 6) 联机序列化携带 team / teamMode
  const serializePlayer = {
    id: 'sp1', name: '你', seatNum: 0, team: 0, isAI: false, character: null,
    hp: 4, maxHp: 4, hujia: 0,
    handCards: [{ id: 'sc1', name: '杀', suit: 'spade', number: 7, type: 'basic' }],
    equips: {}, judgeCards: [], skills: [], status: 'alive',
  };
  const pubTeam = serializePlayerPublic(serializePlayer);
  assert(pubTeam.team === 0, 'serializePlayerPublic 携带 team=0');
  assert(pubTeam.handCardCount === 1 && pubTeam.handCards === undefined,
    '序列化玩家公开信息不额外泄露手牌');
  assert(serializePlayerPublic({ ...serializePlayer, team: undefined }).team === null,
    '引擎未提供 team 时序列化为 null');
  const serializeGameMock = {
    status: 'running',
    config: { teamMode: '2v2' },
    turn: { roundNumber: 2, currentPhase: 'play', currentPlayer: null },
    players: [
      serializePlayer,
      { ...serializePlayer, id: 'sp2', name: '队友1', seatNum: 2, team: 0 },
      { ...serializePlayer, id: 'sp3', name: '敌人1', seatNum: 1, team: 1 },
    ],
    deck: { getInfo: () => ({ remaining: 10, discarded: 3, total: 108, seed: 1 }) },
    logs: [],
  };
  const stateSeat0 = serializeState(serializeGameMock, 0);
  assert(stateSeat0.teamMode === '2v2', '联机状态快照携带 teamMode');
  assert(stateSeat0.players[1].team === 0 && stateSeat0.players[2].team === 1,
    '联机状态快照玩家携带 team');
  assert(Array.isArray(stateSeat0.players[0].handCards)
    && stateSeat0.players[1].handCards === undefined, '状态快照仅自己可见手牌');

  // 7) GameBoard 组队牌桌渲染
  const teamBoardPlayers = [
    { ...serializePlayer, id: 'tp0', name: '你', seatNum: 0, team: 0 },
    { ...serializePlayer, id: 'tp1', name: '敌人1', seatNum: 1, team: 1 },
    { ...serializePlayer, id: 'tp2', name: '队友1', seatNum: 2, team: 0 },
    { ...serializePlayer, id: 'tp3', name: '敌人2', seatNum: 3, team: 1 },
  ].map(p => ({ ...p, handCards: p.seatNum === 0 ? p.handCards : [], handCardCount: p.seatNum === 0 ? 1 : 0 }));
  const teamBoardState = {
    status: 'running', teamMode: '2v2', round: 2, currentPhase: 'play',
    currentPlayer: { id: 'tp1', name: '敌人1' },
    players: teamBoardPlayers,
    deckInfo: { remaining: 40, total: 108, discarded: 2 },
    logs: [{ message: '组队对局开始' }],
  };
  const teamBoardPreview = {
    gameState: teamBoardState, game: null, pendingAction: null,
    effect: null, logs: [{ message: '组队对局开始' }], online: previewOnline,
  };
  const teamBoardHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop, preview: teamBoardPreview, initialLayout: defaultLayout(),
  }));
  assert(teamBoardHtml.includes('2v2 组队'), '组队牌桌顶栏显示 2v2 组队徽标');
  assert(teamBoardHtml.includes('我方') && teamBoardHtml.includes('敌方'),
    '组队牌桌显示我方/敌方标签');
  assert(teamBoardHtml.includes('team-ally') && teamBoardHtml.includes('team-enemy'),
    '组队牌桌队友/敌方描边样式类');
  assert(teamBoardHtml.includes('队友1') && teamBoardHtml.includes('敌人2'),
    '组队牌桌显示队友/敌人座位名');
  assert(!mingshaHtml.includes('team-mode-badge') && !mingshaHtml.includes('team-chip'),
    '自由混战牌桌不显示队伍标签');
  const teamFinishedState = {
    ...teamBoardState,
    status: 'finished',
    players: teamBoardPlayers.map(p => (
      p.team === 1 ? { ...p, status: 'dead' } : { ...p, status: 'alive' }
    )),
  };
  const teamFinishedHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop,
    preview: { ...teamBoardPreview, gameState: teamFinishedState },
    initialLayout: defaultLayout(),
  }));
  assert(teamFinishedHtml.includes('你与队友获胜'), '组队终局浮层显示“你与队友获胜”文案');

  console.log('\n[25] 距离可视化：纯函数 / 牌桌 chip / 目标列表 / 开关');
  const mkDistPlayer = (id, seat, extra = {}) => ({
    id, name: `P${seat}`, seatNum: seat, status: 'alive', equips: {},
    hp: 4, maxHp: 4, handCards: [], handCardCount: 0, judgeCards: [], skills: [], usedJiu: false,
    ...extra,
  });
  const ring4 = [mkDistPlayer('p0', 0), mkDistPlayer('p1', 1), mkDistPlayer('p2', 2), mkDistPlayer('p3', 3)];
  const me = ring4[0];

  const shuffled = [mkDistPlayer('a', 3), mkDistPlayer('b', 1), mkDistPlayer('c', 0), mkDistPlayer('d', 2)];
  assert(aliveSeatOrder(shuffled).map(p => p.id).join(',') === 'c,b,d,a', '存活玩家按 seatNum 排序成环');
  assert(seatDistance(me, ring4[1], ring4) === 1 && seatDistance(me, ring4[2], ring4) === 2
    && seatDistance(me, ring4[3], ring4) === 1, '4 人环形座次距离：相邻 1 / 对面 2');
  const deadRing = [ring4[0], { ...ring4[1], status: 'dead' }, ring4[2], ring4[3]];
  assert(aliveSeatOrder(deadRing).map(p => p.id).join(',') === 'p0,p2,p3', '死亡玩家不参与存活环');
  assert(seatDistance(me, ring4[2], deadRing) === 1 && seatDistance(me, ring4[3], deadRing) === 1,
    '死亡后存活列表重排，距离重新计算');
  assert(seatDistance(me, me, ring4) === 0, '目标自己座次距离为 0');
  assert(aliveSeatOrder([ring4[0]]).length === 1 && seatDistance(ring4[0], ring4[0], [ring4[0]]) === 0,
    '仅 1 名存活时不抛错');
  assert(aliveSeatOrder(null).length === 0 && seatDistance(null, null, null) === null,
    '空输入返回安全值');
  assert(seatDistance(mkDistPlayer('x', 9), me, ring4) === null, '不在存活环内的玩家返回 null');

  assert(attackDistance(me, ring4[2], ring4) === 2, '攻击距离 = 座次距离（无马）');
  const defHorseRing = ring4.map(p => (
    p.id === 'p2' ? { ...p, equips: { horse_def: { name: '的卢' } } } : p
  ));
  assert(attackDistance(defHorseRing[0], defHorseRing[2], defHorseRing) === 3,
    '目标防御马 +1 攻击距离');
  const atkHorseMe = { ...me, equips: { horse_atk: { name: '赤兔' } } };
  const atkHorseRing = [atkHorseMe, ring4[1], ring4[2], ring4[3]];
  assert(attackDistance(atkHorseMe, ring4[2], atkHorseRing) === 1, '自己进攻马 -1 攻击距离');
  const bothHorseRing = defHorseRing.map(p => (
    p.id === 'p0' ? { ...p, equips: { horse_atk: { name: '赤兔' } } } : p
  ));
  assert(attackDistance(bothHorseRing[0], bothHorseRing[2], bothHorseRing) === 2,
    '进攻马与防御马同时生效');
  assert(attackDistance({ ...me, distanceFix: 1 }, ring4[2], ring4) === 3,
    '自己 distanceFix 计入攻击距离');

  assert(attackRange(me) === 1, '无武器攻击范围 = 1');
  assert(attackRange({ ...me, equips: { weapon: { name: '麒麟弓', range: 5 } } }) === 5,
    '武器 range 决定攻击范围');
  assert(attackRange({ ...me, equips: { weapon: { name: '方天画戟' } } }) === 4,
    '联机快照缺 range 时按武器名兜底（方天画戟=4）');
  assert(attackRange({ ...me, equips: { weapon: { name: '自定义武器', range: '3' } } }) === 3,
    '字符串 range 也能解析');
  assert(attackRange({ ...me, equips: { weapon: { name: '未知武器' } } }) === 1,
    '未知武器缺 range 时兜底 1');
  assert(weaponName({ ...me, equips: { weapon: { name: '青龙偃月刀' } } }) === '青龙偃月刀',
    'weaponName 读取武器名');

  assert(isInAttackRange(me, ring4[1], ring4) === true, '范围 1 时相邻目标在攻击范围内');
  assert(isInAttackRange(me, ring4[2], ring4) === false, '范围 1 时对面目标不在攻击范围内');
  const range5Me = { ...me, equips: { weapon: { name: '麒麟弓', range: 5 } } };
  assert(isInAttackRange(range5Me, ring4[2], [range5Me, ring4[1], ring4[2], ring4[3]]) === true,
    '武器范围 5 时可攻击对面');
  assert(isInAttackRange(me, me, ring4) === false, '自己不作为攻击目标');
  assert(isInAttackRange(null, ring4[1], ring4) === null, '空攻击者返回 null');

  const hint = distanceHint(me, ring4[2], ring4);
  assert(hint.distance === 2 && hint.range === 1 && hint.inRange === false
    && hint.label === '距离 2' && hint.title.includes('攻击范围外（你的攻击范围 1）'),
  'distanceHint 汇总距离/范围/范围外文案');
  const rangeHint = attackRangeHint({ ...me, equips: { weapon: { name: '青龙偃月刀', range: 3 } } });
  assert(rangeHint.label === '攻击范围 3' && rangeHint.title.includes('青龙偃月刀'),
    'attackRangeHint 带武器名');
  assert(attackRangeHint(me).title.includes('未装备武器'), '无武器时攻击范围说明');
  assert(targetLabelWithDistance(me, ring4[2], ring4) === 'P2 · 距离2',
    '目标按钮文案追加距离');

  let distThrew = false;
  try {
    aliveSeatOrder('bad');
    seatDistance(undefined, undefined, undefined);
    attackDistance({}, {}, null);
    attackRange(null);
    isInAttackRange(undefined, {}, 'bad');
    distanceHint({}, {}, null);
    attackRangeHint(undefined);
    targetLabelWithDistance(null, null, null);
  } catch {
    distThrew = true;
  }
  assert(!distThrew, '异常输入不抛错，安全降级');

  // PlayerArea：距离 chip 与范围内/外文案
  renderPage('PlayerArea(距离-范围内)', React.createElement(PlayerArea, {
    player: ring4[1], isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', selfSeatNum: 0,
    showDistance: true, distanceMe: me, distancePlayers: ring4,
  }), ['距离 1', 'in-range', '攻击范围内', '攻击范围 1']);
  renderPage('PlayerArea(距离-范围外)', React.createElement(PlayerArea, {
    player: ring4[2], isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', selfSeatNum: 0,
    showDistance: true, distanceMe: me, distancePlayers: ring4,
  }), ['距离 2', 'out-range', '攻击范围外', '攻击范围 1']);
  const ffaDistOffHtml = renderToString(React.createElement(PlayerArea, {
    player: ring4[1], isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', selfSeatNum: 0,
    showDistance: false, distanceMe: me, distancePlayers: ring4,
  }));
  assert(!ffaDistOffHtml.includes('distance-chip'), '关闭显示距离后 PlayerArea 不渲染距离 chip');

  // SelfCharacterCard：攻击范围 chip / tooltip
  const meWithWeapon = {
    ...me,
    name: '你',
    equips: { weapon: { name: '青龙偃月刀', range: 3 } },
  };
  renderPage('SelfCharacterCard(攻击范围)', React.createElement(SelfCharacterCard, {
    player: meWithWeapon, showDistance: true,
  }), ['攻击范围 3', 'range-chip', '青龙偃月刀']);
  renderPage('SelfCharacterCard(默认范围)', React.createElement(SelfCharacterCard, {
    player: { ...me, name: '你' }, showDistance: true,
  }), ['攻击范围 1']);
  const selfRangeOffHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: meWithWeapon, showDistance: false,
  }));
  assert(!selfRangeOffHtml.includes('distance-chip')
    && selfRangeOffHtml.includes('攻击范围 3'), '关闭开关后隐藏范围 chip 但 tooltip 保留攻击范围');

  // ActionPanel：目标列表追加距离
  const shaCard = { id: 'sha-dist', name: '杀', suit: 'spade', number: 7, type: 'basic' };
  renderPage('ActionPanel(目标距离)', React.createElement(ActionPanel, {
    action: {
      type: 'play', player: me, playableIds: [shaCard.id],
      targetsByCard: { 杀: [ring4[1], ring4[2]] },
    },
    onResolve: noop, selectedCards: [shaCard], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, distancePlayers: ring4, showDistance: true,
  }), ['距离1', '距离2', 'P1', 'P2']);
  renderPage('ActionPanel(技能选目标距离)', React.createElement(ActionPanel, {
    action: { type: 'chooseTarget', player: me, candidates: [ring4[1], ring4[2]], hint: '选择目标' },
    onResolve: noop, selectedCards: [], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, distancePlayers: ring4, showDistance: true,
  }), ['距离1', '距离2', 'P1', 'P2']);
  const panelDistOffHtml = renderToString(React.createElement(ActionPanel, {
    action: {
      type: 'play', player: me, playableIds: [shaCard.id],
      targetsByCard: { 杀: [ring4[1], ring4[2]] },
    },
    onResolve: noop, selectedCards: [shaCard], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, distancePlayers: ring4, showDistance: false,
  }));
  assert(!panelDistOffHtml.includes('距离1') && !panelDistOffHtml.includes('距离2'),
    '关闭显示距离后目标列表不追加距离');

  // GameBoard 布局：默认显示距离；关闭后所有 distance chip 隐藏
  const distancePreviewState = {
    status: 'running', round: 2, currentPhase: 'play',
    currentPlayer: { id: 'p2', name: 'P2' },
    players: ring4,
    deckInfo: { remaining: 40, total: 108, discarded: 2 },
    logs: [],
  };
  const distancePreview = {
    gameState: distancePreviewState, game: null, pendingAction: null,
    effect: null, logs: [], online: previewOnline,
  };
  const distBoardHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop, preview: distancePreview, initialLayout: defaultLayout(),
  }));
  assert(distBoardHtml.includes('距离 1') && distBoardHtml.includes('距离 2'),
    '名将杀式牌桌默认显示其他玩家距离 chip');
  assert(distBoardHtml.includes('攻击范围 1'), '自己武将卡显示攻击范围');
  const distOffBoardHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop,
    preview: distancePreview,
    initialLayout: updateLayout(defaultLayout(), { showDistance: false }),
  }));
  assert(!distOffBoardHtml.includes('distance-chip'), '布局设置关闭距离提示后牌桌无距离 chip');
  const distHtmlCss = readFileSync('src/App.css', 'utf8');
  assert(distHtmlCss.includes('.distance-chip') && distHtmlCss.includes('.distance-chip.in-range')
    && distHtmlCss.includes('.distance-chip.out-range'), 'App.css 提供距离 chip 样式');
  assert(distHtmlCss.includes('prefers-reduced-motion'), 'App.css 保留减少动态效果处理');

  console.log('\n[26] 允许攻击队友（误伤）：设置 / config / 目标标记 / 序列化');
  assert(friendlyFireDisabled('ffa') === true && friendlyFireDisabled('2v2') === false
    && friendlyFireDisabled('3v3') === false, '自由混战禁用误伤，组队可用');
  assert(normalizeFriendlyFire('2v2', true) === true && normalizeFriendlyFire('2v2', false) === false
    && normalizeFriendlyFire('ffa', true) === false && normalizeFriendlyFire('3v3', 'yes') === false,
  '误伤值归一化：仅组队显式 true 生效');
  const ffOptions2v2 = buildStartOptions('2v2', true);
  assert(ffOptions2v2.teamMode === '2v2' && ffOptions2v2.friendlyFire === true,
    'startGame options 携带 teamMode + friendlyFire');
  assert(buildStartOptions('ffa', true).friendlyFire === false, '自由混战 options.friendlyFire 强制 false');
  assert(isTeammateTarget({ team: 0 }, { team: 0 }, '2v2') === true
    && isTeammateTarget({ team: 0 }, { team: 1 }, '2v2') === false, '误伤判断：同队 true / 异队 false');
  assert(isTeammateTarget({ team: 0 }, { team: 0 }, 'ffa') === false, '自由混战不识别队友目标');
  assert(isTeammateTarget({ seatNum: 2 }, { seatNum: 0 }, '2v2') === true
    && isTeammateTarget({ seatNum: 1 }, { seatNum: 0 }, '2v2') === false,
  '缺少 team 字段时按座位推断队友');
  assert(isTeammateTarget({ id: 'a', team: 0 }, { id: 'a', team: 0 }, '2v2') === false,
    '自己不作为队友目标');

  const ffStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(readDefaultFriendlyFire(ffStorage) === false, '默认误伤开关关闭');
  ffStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ friendlyFire: true, playerCount: 4 }));
  assert(readDefaultFriendlyFire(ffStorage) === true, '读取设置页保存的默认误伤开关');
  ffStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ friendlyFire: 'yes' }));
  assert(readDefaultFriendlyFire(ffStorage) === false, '非法误伤值回退 false');
  ffStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify({ playerCount: 5 }));
  assert(saveDefaultFriendlyFire(true, ffStorage) === true, '保存默认误伤开关');
  const savedFfCfg = JSON.parse(ffStorage.getItem(GAME_CONFIG_STORAGE_KEY));
  assert(savedFfCfg.friendlyFire === true && savedFfCfg.playerCount === 5,
    '保存误伤时合并不覆盖其它游戏设置');

  // SetupPanel SSR：组队可勾选 / ffa 禁止并重置
  const ffSetupHtml = renderToString(React.createElement(SetupPanel, {
    characters: [], skills: [], onStart: noop,
    initialTeamMode: '2v2', initialFriendlyFire: true,
  }));
  assert(ffSetupHtml.includes('允许攻击队友（误伤）'), 'SetupPanel 包含误伤复选框');
  assert(ffSetupHtml.includes('默认关闭') && ffSetupHtml.includes('AI 仍不主动攻击队友'),
    'SetupPanel 显示误伤说明文字');
  assert(ffSetupHtml.includes('checked=""'), '组队模式下误伤复选框可勾选');
  const ffFfaSetupHtml = renderToString(React.createElement(SetupPanel, {
    characters: [], skills: [], onStart: noop,
    initialTeamMode: 'ffa', initialFriendlyFire: true,
  }));
  assert(!ffFfaSetupHtml.includes('checked=""') && ffFfaSetupHtml.includes('ff-toggle disabled'),
    '自由混战时误伤复选框禁用并重置为 false');

  // ActionPanel：误伤开启时队友目标加「队友」标签与警示
  const ffMe = { id: 'ffme', name: '你', seatNum: 0, team: 0, status: 'alive', equips: {} };
  const ffAlly = { id: 'ffally', name: '队友1', seatNum: 2, team: 0, status: 'alive', equips: {} };
  const ffEnemy = { id: 'ffenemy', name: '敌人1', seatNum: 1, team: 1, status: 'alive', equips: {} };
  const ffPlayers = [ffMe, ffEnemy, ffAlly, { id: 'ffp3', name: '敌人2', seatNum: 3, team: 1, status: 'alive', equips: {} }];
  const ffShaCard = { id: 'ff-sha', name: '杀', suit: 'spade', number: 7, type: 'basic' };
  const ffPanelAction = {
    type: 'play', player: ffMe, playableIds: [ffShaCard.id],
    targetsByCard: { 杀: [ffAlly, ffEnemy] },
  };
  renderPage('ActionPanel(误伤目标标记)', React.createElement(ActionPanel, {
    action: ffPanelAction,
    onResolve: noop, selectedCards: [ffShaCard], setSelectedCards: noop,
    selectedTarget: ffAlly, setSelectedTarget: noop,
    game: null, distancePlayers: ffPlayers, showDistance: true,
    teamMode: '2v2', friendlyFire: true,
  }), ['队友1 · 距离2 · 队友', 'target-ally', '将攻击队友', '（队友，将攻击队友）']);
  const ffOffPanelHtml = renderToString(React.createElement(ActionPanel, {
    action: ffPanelAction,
    onResolve: noop, selectedCards: [ffShaCard], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, distancePlayers: ffPlayers, showDistance: true,
    teamMode: '2v2', friendlyFire: false,
  }));
  assert(!ffOffPanelHtml.includes('· 队友') && !ffOffPanelHtml.includes('target-ally'),
    '关闭误伤时目标列表不含队友标签');
  renderPage('ActionPanel(技能选目标-误伤)', React.createElement(ActionPanel, {
    action: { type: 'chooseTarget', player: ffMe, candidates: [ffAlly, ffEnemy], hint: '选择目标' },
    onResolve: noop, selectedCards: [], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, distancePlayers: ffPlayers, showDistance: true,
    teamMode: '2v2', friendlyFire: true,
  }), ['· 队友', 'target-ally']);

  // store：写入 game.config.friendlyFire / lastFriendlyFire（真实 startGame 路径）
  const storeSrcForFf = readFileSync('src/store/gameStore.js', 'utf8');
  assert(storeSrcForFf.includes('game.config.friendlyFire = friendlyFire')
    && storeSrcForFf.includes('lastFriendlyFire'), 'store 写入 game.config.friendlyFire 并保留 lastFriendlyFire');
  try {
    await store.getState().startGame(
      [{ name: 'A', isAI: true, team: 0 }, { name: 'B', isAI: true, team: 1 }],
      42, { teamMode: '2v2', friendlyFire: true },
    );
    const ffGame = store.getState().game;
    assert(ffGame?.config?.friendlyFire === true && store.getState().lastFriendlyFire === true,
      'store.startGame 将误伤写入 game.config 与 lastFriendlyFire');
    store.getState().initGame();
  } catch (e) {
    assert(false, 'store.startGame 误伤路径执行异常', e.message);
  }

  // 联机序列化：状态快照带 friendlyFire
  const ffSerializeGame = {
    ...serializeGameMock,
    config: { teamMode: '2v2', friendlyFire: true },
  };
  assert(serializeState(ffSerializeGame, 0).friendlyFire === true, '联机状态快照携带 friendlyFire=true');
  assert(serializeState(serializeGameMock, 0).friendlyFire === false,
    '未开启误伤时状态快照 friendlyFire=false');

  // 牌桌：误伤开启时顶栏显示提示
  const ffBoardHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop,
    preview: { ...teamBoardPreview, gameState: { ...teamBoardState, friendlyFire: true } },
    initialLayout: defaultLayout(),
  }));
  assert(ffBoardHtml.includes('误伤开启'), '误伤开启时牌桌顶栏显示“误伤开启”');
  assert(!teamBoardHtml.includes('误伤开启'), '未开启误伤时牌桌不显示提示');

  console.log('\n[27] 图标系统与 iPhone 式丝滑动效');
  assert(ICON_NAMES.length >= 35, '图标清单数量充足', ICON_NAMES.length);
  for (const name of ICON_NAMES) {
    const iconHtml = renderToString(React.createElement(Icon, { name }));
    assert(iconHtml.includes('ui-icon') && iconHtml.includes(`ui-icon--${name}`),
      `Icon 渲染：${name}`);
  }
  const sampleIconHtml = renderToString(React.createElement(Icon, {
    name: 'shield', size: 20, className: 'test-x',
  }));
  assert(sampleIconHtml.includes('viewBox="0 0 24 24"'), '图标统一 24 viewBox');
  assert(sampleIconHtml.includes('stroke-width="1.7"')
    && sampleIconHtml.includes('stroke="currentColor"'), '图标统一 strokeWidth 1.7 / currentColor');
  assert(sampleIconHtml.includes('aria-hidden="true"') && sampleIconHtml.includes('test-x')
    && sampleIconHtml.includes('width="20"'), '图标 size / className / aria 透传');

  // emoji / 字符图标替换
  const settingsIconHtml = renderToString(React.createElement(Settings, { navigate: noop }));
  assert(!settingsIconHtml.includes('📦') && settingsIconHtml.includes('data-icon="package"'),
    'Settings「数据管理」📦 已替换为 package 图标');
  const shieldPlayer = {
    id: 'shield-p1', name: '护甲测试', seatNum: 1, team: 1, status: 'alive',
    hp: 4, maxHp: 4, hujia: 2, handCards: [], handCardCount: 0,
    equips: {}, judgeCards: [], skills: [], usedJiu: false,
  };
  const shieldHtml = renderToString(React.createElement(PlayerArea, {
    player: shieldPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  }));
  assert(!shieldHtml.includes('🛡') && shieldHtml.includes('data-icon="shield"'),
    '护甲 🛡 已替换为 shield 图标');
  assert(!classicHtml.includes('>⚙') && classicHtml.includes('data-icon="layout"'),
    '顶栏「⚙ 布局」已替换为 layout 图标');
  assert(classicHtml.includes('data-icon="exit"') && classicHtml.includes('data-icon="book"')
    && classicHtml.includes('data-icon="log"'), '顶栏按钮统一使用线性图标');
  assert(!classicHtml.includes('📦') && !classicHtml.includes('🛡'),
    '牌桌渲染不含 📦 / 🛡 emoji');

  // App.css 动效 tokens / 关键样式
  const appCssUi = readFileSync('src/App.css', 'utf8');
  assert(appCssUi.includes('--ease-ios: cubic-bezier(0.32, 0.72, 0, 1)')
    && appCssUi.includes('--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)'),
  '动效 tokens：--ease-ios / --ease-spring');
  assert(appCssUi.includes('--dur-fast: 160ms') && appCssUi.includes('--dur: 280ms')
    && appCssUi.includes('--dur-slow: 420ms'), '动效 tokens：--dur-fast / --dur / --dur-slow');
  assert(appCssUi.includes('--radius-sheet: 24px'), '底部 sheet 圆角 token');
  assert(appCssUi.includes('@media (prefers-reduced-motion: reduce)'), '包含 prefers-reduced-motion 降级');
  assert(appCssUi.includes('.btn:active') && appCssUi.includes('scale(0.97)'), '按钮按压缩放反馈');
  assert(appCssUi.includes('.ui-icon') && appCssUi.includes('.btn .ui-icon'), '图标与按钮排版对齐');
  assert(appCssUi.includes('@keyframes sheetUp') && appCssUi.includes('.board-center .action-panel'),
    '移动端 ActionPanel 底部 sheet 样式');
  assert(appCssUi.includes('@keyframes menuItemIn') && appCssUi.includes('.menu-buttons .btn:nth-child(8)'),
    '菜单入口 stagger 入场');
  assert(appCssUi.includes('@keyframes uiPop') && appCssUi.includes('.hp-dot.filled'),
    'HP / chips pop 动效');
  assert(appCssUi.includes('backdrop-filter: blur(14px) saturate(1.2)'), '毛玻璃层次样式');
  assert(appCssUi.includes('pageIn var(--dur) var(--ease-ios)'), '页面切换 280ms ease-ios');
  const appJsxSrc = readFileSync('src/App.jsx', 'utf8');
  assert(appJsxSrc.includes('page-view page-transition') && appJsxSrc.includes('key={currentPage}'),
    'App 视图容器带过渡 class 与 key');
  const iconSrc = readFileSync('src/components/ui/Icon.jsx', 'utf8');
  assert(iconSrc.includes('strokeWidth: 1.7') && iconSrc.includes("viewBox: '0 0 24 24'"),
    'Icon 组件统一 24 viewBox / strokeWidth 1.7');
  assert(iconSrc.includes('ICON_NAMES'), 'Icon 导出图标名清单便于测试');

  console.log('\n[28] 速玩 / 扫码即玩：启动参数 / 地址策略 / 页面');
  const lpEmpty = parseLaunchParams('');
  assert(lpEmpty.mode === 'menu' && lpEmpty.quick === false && lpEmpty.room === null,
    '无启动参数 → 主菜单');
  const lpQuick = parseLaunchParams('?quick=1');
  assert(lpQuick.mode === 'quick' && lpQuick.quick === true && lpQuick.room === null,
    '?quick=1 → 直接速玩');
  assert(parseLaunchParams('?quick=true').quick === true, '?quick=true 也视为速玩');
  assert(parseLaunchParams('?quick=0').mode === 'menu', '?quick=0 不触发速玩');
  const lpRoom = parseLaunchParams('?room=abc12');
  assert(lpRoom.mode === 'room' && lpRoom.room === 'ABC12' && lpRoom.quick === false,
    '?room=CODE → 进入联机大厅并统一大写');
  assert(parseLaunchParams('?room=ab').room === null
    && parseLaunchParams('?room=ab').mode === 'menu', '非法房间号被忽略');
  assert(parseLaunchParams('?room=%3Cscript%3E').mode === 'menu', '房间号注入字符被忽略');
  const lpBoth = parseLaunchParams('?quick=1&room=ABCDE');
  assert(lpBoth.mode === 'room' && lpBoth.room === 'ABCDE' && lpBoth.quick === false,
    'quick 与 room 同时存在时 room 优先');
  assert(parseLaunchParams(null).mode === 'menu', 'null 启动参数安全回退');

  const lanAddr = buildLanAddress({
    origin: 'http://localhost:3000', hostname: 'localhost', port: '3000',
    protocol: 'http:', lanIps: ['192.168.1.5'],
  });
  assert(lanAddr.mode === 'lan' && lanAddr.baseUrl === 'http://192.168.1.5:3000'
    && lanAddr.warning === null, 'localhost + lanIps → 优先局域网 IP');
  const mobileAddr = buildLanAddress({
    origin: 'http://192.168.1.9:3000', hostname: '192.168.1.9', port: '3000',
    protocol: 'http:', lanIps: [],
  });
  assert(mobileAddr.mode === 'origin' && mobileAddr.baseUrl === 'http://192.168.1.9:3000'
    && mobileAddr.warning === null, '手机直接访问 → 使用当前 origin');
  const localNoLan = buildLanAddress({
    origin: 'http://localhost:3000', hostname: 'localhost', port: '3000',
    protocol: 'http:', lanIps: [],
  });
  assert(localNoLan.mode === 'localhost' && localNoLan.isLocalhost === true
    && localNoLan.warning.includes('localhost') && localNoLan.warning.includes('局域网 IP'),
  'localhost 且无 lanIps → 显示警告与获取说明');
  const lanPort80 = buildLanAddress({
    origin: 'http://localhost', hostname: 'localhost', port: '', protocol: 'http:',
    lanIps: ['10.0.0.5'],
  });
  assert(lanPort80.baseUrl === 'http://10.0.0.5', '默认 80 端口不拼接端口');
  assert(buildLanAddress({}).baseUrl === '', '无任何地址信息时安全降级');

  const quickLink = buildQuickPlayUrl({ baseUrl: 'http://192.168.1.5:3000', kind: 'quick' });
  assert(quickLink === 'http://192.168.1.5:3000/?quick=1', '生成单机速玩链接');
  const roomLink = buildQuickPlayUrl({
    baseUrl: 'http://192.168.1.5:3000/', kind: 'room', code: 'abcde',
  });
  assert(roomLink === 'http://192.168.1.5:3000/?room=ABCDE', '生成房间链接并统一大写');
  assert(buildQuickPlayUrl({ baseUrl: '', kind: 'quick' }) === '', '无地址时链接为空');
  assert(buildQuickPlayUrl({ baseUrl: 'http://x', kind: 'room', code: '' }) === '',
    '无房间号时房间链接为空');

  const qrOk = resolveQuickPlayQr({ url: 'http://x/?quick=1', data: '<svg></svg>' });
  assert(qrOk.canShowQr === true && qrOk.fallback === false, '二维码可用时正常展示');
  const qrFail = resolveQuickPlayQr({ url: 'http://x/?quick=1', data: '', error: 'boom' });
  assert(qrFail.canShowQr === false && qrFail.fallback === true
    && qrFail.link === 'http://x/?quick=1' && qrFail.fallbackText.length > 0,
  '二维码失败时降级为可复制链接');
  assert(resolveQuickPlayQr({}).fallback === true, '无地址时降级链接');

  assert(pickQuickPlayLayout({ width: 390, hasStoredLayout: false }) === 'compact',
    '手机窄屏且无布局设置 → 自动紧凑布局');
  assert(pickQuickPlayLayout({ width: 390, hasStoredLayout: true }) === null,
    '已有 cgm_layout → 不覆盖用户设置');
  assert(pickQuickPlayLayout({ width: 1280, hasStoredLayout: false }) === 'mingsha',
    '宽屏速玩 → 名将杀式');
  assert(pickQuickPlayLayout({ width: 0, hasStoredLayout: false }) === null,
    '未知宽度不强行改布局');
  const quickConfigs = buildQuickPlayConfigs();
  assert(quickConfigs.length === 2 && quickConfigs[0].name === '你'
    && quickConfigs[0].isAI === false && quickConfigs[1].name === 'AI1'
    && quickConfigs[1].isAI === true, '速玩默认配置：你 + AI1 两人');

  const quickPlayHtml = renderToString(React.createElement(QuickPlay, { navigate: noop }));
  assert(quickPlayHtml.includes('速玩 / 扫码即玩'), 'QuickPlay 标题：速玩 / 扫码即玩');
  for (const text of ['手机单机速玩', '创建速玩房间', '扫码', '?quick=1', '?room=',
    '同一局域网', '无需安装', '相机', '微信', '支付宝', '浏览器', '复制链接']) {
    assert(quickPlayHtml.includes(text), `QuickPlay 含「${text}」`);
  }
  assert(quickPlayHtml.includes('创建速玩房间') && quickPlayHtml.includes('房间号'),
    'QuickPlay 含房间创建入口与房间号说明');
  renderPage('App(无启动参数)', React.createElement(App), ['CardGameMaker', '速玩', '开始游戏']);
  const appSrcForQuick = readFileSync('src/App.jsx', 'utf8');
  assert(appSrcForQuick.includes('parseLaunchParams') && appSrcForQuick.includes('replaceState'),
    'App 解析启动参数并清 query');
  assert(appSrcForQuick.includes('buildQuickPlayConfigs') && appSrcForQuick.includes('pickQuickPlayLayout'),
    'App 速玩自动开局与手机布局选择');

  console.log('\n[29] 演出特效：处决 / 濒死 / 判定 / 回复 / 雷击');
  renderPage('ExecutionOverlay(处决)', React.createElement(ExecutionOverlay, {
    fx: { kind: 'execution', victim: '关羽', source: '张飞', text: '斩' },
  }), ['fx-execution', 'fx-execution-vignette', 'fx-blade', '斩', '关羽', '张飞', 'fx-ember']);
  renderPage('ExecutionOverlay(无来源)', React.createElement(ExecutionOverlay, {
    fx: { kind: 'execution', victim: '关羽' },
  }), ['阵亡', '关羽']);
  renderPage('DyingPulse(濒死)', React.createElement(DyingPulse, {
    fx: { kind: 'dying', player: '关羽' },
  }), ['fx-dying', 'fx-dying-ring', '濒死', '关羽']);
  renderPage('JudgeReveal(生效)', React.createElement(JudgeReveal, {
    fx: {
      kind: 'judge', player: '关羽', delayCard: '闪电', success: true,
      card: { name: '闪电', suitSymbol: '♠', numberDisplay: 'A', isRed: false },
    },
  }), ['fx-judge', '判定生效', '闪电', '♠', 'A', 'success']);
  renderPage('JudgeReveal(不中)', React.createElement(JudgeReveal, {
    fx: {
      kind: 'judge', player: '关羽', delayCard: '乐不思蜀', success: false,
      card: { name: '桃', suitSymbol: '♥', numberDisplay: '7', isRed: true },
    },
  }), ['判定不中', 'fail', '♥']);
  renderPage('HealPop(回复)', React.createElement(HealPop, {
    fx: { kind: 'heal', player: '关羽', num: 2 },
  }), ['fx-heal', '回复', '+2', '关羽', 'fx-heal-spark']);
  renderPage('ThunderFlash(雷击)', React.createElement(ThunderFlash, {
    fx: { kind: 'thunder', player: '关羽' },
  }), ['fx-thunder', 'fx-lightning', '雷击']);
  const fxLayerHtml = renderToString(React.createElement(FxLayer, {
    queue: [{ kind: 'judge', id: 't1', success: true }], onShift: noop,
  }));
  assert(fxLayerHtml.includes('fx-layer') && fxLayerHtml.includes('data-fx-layer="judge"'),
    'FxLayer 按队列播放当前特效');
  assert(renderToString(React.createElement(FxLayer, { queue: [], onShift: noop })) === '',
    'FxLayer 空队列不渲染');

  const fxDeath = mapEffectToFx({ type: 'death', player: { name: '关羽' }, source: { name: '张飞' }, reason: 'kill' });
  assert(fxDeath.kind === 'execution' && fxDeath.victim === '关羽'
    && fxDeath.source === '张飞' && fxDeath.text === '斩', 'mapEffectToFx：death → 处决');
  assert(mapEffectToFx({ type: 'death', player: { name: '关羽' } }).text === '阵亡',
    'mapEffectToFx：无来源 death 显示阵亡');
  const fxDying = mapEffectToFx({ type: 'dying', player: { name: '关羽' }, source: { name: '张飞' } });
  assert(fxDying.kind === 'dying' && fxDying.player === '关羽', 'mapEffectToFx：dying → 濒死');
  const fxJudgeOk = mapEffectToFx({
    type: 'judge', card: { name: '闪电', suit: 'spade', numberDisplay: 'A' },
    delayCard: { name: '闪电' }, success: true,
  });
  assert(fxJudgeOk.kind === 'judge' && fxJudgeOk.success === true
    && fxJudgeOk.card.suitSymbol === '♠' && fxJudgeOk.text === '判定生效',
  'mapEffectToFx：judge 生效');
  const fxJudgeFail = mapEffectToFx({ type: 'judge', card: { name: '桃', suit: 'heart' }, success: false });
  assert(fxJudgeFail.success === false && fxJudgeFail.text === '判定不中'
    && fxJudgeFail.card.isRed === true, 'mapEffectToFx：judge 不中且红色花色');
  assert(mapEffectToFx({ type: 'heal', player: { name: '关羽' }, num: 3 }).num === 3,
    'mapEffectToFx：heal 数字');
  assert(mapEffectToFx({ type: 'heal', player: { name: '关羽' }, num: 0 }).num === 1,
    'mapEffectToFx：非法回复量兜底 1');
  const fxThunder = mapEffectToFx({ type: 'damage', target: { name: '关羽' }, nature: 'thunder' });
  assert(fxThunder.kind === 'thunder', 'mapEffectToFx：damage.nature=thunder → 雷击');
  assert(mapEffectToFx({ type: 'damage', target: { name: '关羽' }, card: { name: '闪电' } }).kind === 'thunder',
    'mapEffectToFx：闪电伤害 → 雷击');
  assert(mapEffectToFx({ type: 'draw', player: { name: '关羽' } }) === null, '未知/非演出效果忽略');
  assert(mapEffectToFx(null) === null && mapEffectToFx({}) === null, '空效果安全忽略');
  let fxThrew = false;
  try {
    mapEffectToFx({ type: 'death', player: '字符串', source: 42, reason: {} });
    mapEffectToFx({ type: 'judge', card: 'bad', success: 'no' });
  } catch { fxThrew = true; }
  assert(!fxThrew, '异常 effect 不抛错');

  const q0 = [];
  const q1 = enqueueFx(q0, { kind: 'execution', id: 'd1' });
  const q2 = enqueueFx(q1, { kind: 'execution', id: 'd2' });
  assert(q1.length === 1 && q2.length === 2, '多个 death 可排队');
  const q3 = enqueueFx(q2, { kind: 'heal', id: 'h1' });
  assert(q3.some(f => f.kind === 'heal') && !q3.some(f => f.kind === 'dying'),
    'heal 入队关闭濒死');
  let capped = [];
  for (let i = 0; i < 5; i++) capped = enqueueFx(capped, { kind: 'judge', id: `j${i}` });
  assert(capped.length === 3 && capped[2].id === 'j4', '特效队列上限 3');
  assert(shiftFx(q2).length === 1 && shiftFx([]).length === 0, '出队逻辑');
  assert(fxDuration({ kind: 'execution' }) === 1400 && fxDuration({}) === 1000,
    '特效时长兜底');

  const previewExec = parseFxPreview('?fx=execution&name=关羽&source=张飞');
  assert(previewExec && previewExec.kind === 'execution' && previewExec.name === '关羽'
    && previewExec.source === '张飞', '解析 ?fx=execution 预览参数');
  assert(parseFxPreview('?fx=thunder').kind === 'thunder', '解析 ?fx=thunder');
  assert(parseFxPreview('?fx=nope') === null && parseFxPreview('') === null
    && parseFxPreview(null) === null, '非法预览参数忽略');
  const pv = buildPreviewFx({ kind: 'execution', name: '关羽', source: '张飞' });
  assert(pv.kind === 'execution' && pv.victim === '关羽' && pv.source === '张飞'
    && pv.text === '斩', '预览处决特效参数');
  assert(buildPreviewFx({ kind: 'heal', name: '关羽' }).num === 2, '预览回复 +2');
  assert(buildPreviewFx({ kind: 'judge', source: 'fail' }).success === false, '预览判定不中');
  assert(buildPreviewFx({ kind: 'nope' }) === null, '非法预览类型忽略');

  const fxSfxKeys = SFX_SLOTS.map(s => s.key);
  for (const key of ['sfx:kill', 'sfx:dying', 'sfx:judge', 'sfx:heal']) {
    assert(fxSfxKeys.includes(key), `音效槽位新增 ${key}`);
  }
  const audioFxSrc = readFileSync('src/audio/audioManager.js', 'utf8');
  assert(audioFxSrc.includes("name === 'kill'") && audioFxSrc.includes("name === 'dying'")
    && audioFxSrc.includes("name === 'judge'") && audioFxSrc.includes("name === 'heal'"),
  'kill/dying/judge/heal 为合成音效');
  assert(audioFxSrc.includes("'sfx:kill': 'builtin'") && audioFxSrc.includes("'sfx:heal': 'builtin'"),
    '新音效默认 builtin 采样槽位');
  const appCssFx = readFileSync('src/App.css', 'utf8');
  for (const keyframe of ['fxShakeHard', 'fxBrushStamp', 'fxBladeA', 'fxDyingPulse',
    'fxJudgeFlip', 'fxHealSpark', 'fxThunderFlash']) {
    assert(appCssFx.includes(`@keyframes ${keyframe}`), `App.css 含 ${keyframe} 关键帧`);
  }
  assert(appCssFx.includes('.fx-layer') && appCssFx.includes('pointer-events: none'),
    '特效层不阻塞输入');
  assert(appCssFx.includes('prefers-reduced-motion') && appCssFx.includes('.fx-dying-ring'),
    '特效含 reduced-motion 降级');
  const gameBoardFxSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(gameBoardFxSrc.includes('mapEffectToFx') && gameBoardFxSrc.includes('<FxLayer'),
    'GameBoard 接入特效管线与队列');
  const appFxSrc = readFileSync('src/App.jsx', 'utf8');
  assert(appFxSrc.includes('parseFxPreview') && appFxSrc.includes('FxLayer'),
    'App 支持 ?fx= 预览入口');

  console.log('\n[30] 技能类型联动 / 徽标 / 自动触发设置');
  assert(typeForTrigger('phaseUseBegin') === 'active'
    && typeForTrigger('damaged') === 'trigger', '触发时机 → 默认技能类型');
  const nActive = normalizeComposerSkill({ type: 'active', trigger: 'phaseUseBegin', forced: true });
  assert(nActive.type === 'active' && nActive.trigger === 'phaseUseBegin'
    && nActive.forced === false, 'normalize：phaseUseBegin → active，强制 forced=false');
  const nTrigger = normalizeComposerSkill({ type: 'trigger', trigger: 'damaged', forced: false });
  assert(nTrigger.type === 'trigger' && nTrigger.trigger === 'damaged', 'normalize：damaged → trigger');
  const nLocked = normalizeComposerSkill({ type: 'locked', trigger: 'damaged', forced: false });
  assert(nLocked.type === 'locked' && nLocked.trigger === 'damaged' && nLocked.forced === true,
    'normalize：locked 保持且 forced=true');
  const nFixTrigger = normalizeComposerSkill({ type: 'trigger', trigger: 'phaseUseBegin' });
  assert(nFixTrigger.type === 'trigger' && nFixTrigger.trigger === 'damaged',
    'normalize：trigger 误配 phaseUseBegin 自动改为 damaged');
  const nFixActive = normalizeComposerSkill({ type: 'active', trigger: 'damaged' });
  assert(nFixActive.type === 'active' && nFixActive.trigger === 'phaseUseBegin',
    'normalize：active 强制 phaseUseBegin');

  const trigChange = applyComposerTriggerChange({ type: 'trigger', trigger: 'damaged', forced: false }, 'phaseUseBegin');
  assert(trigChange.type === 'active' && trigChange.trigger === 'phaseUseBegin'
    && trigChange.forced === false, '选择出牌阶段开始 → 自动切主动技');
  const trigOther = applyComposerTriggerChange({ type: 'active', trigger: 'phaseUseBegin', forced: false }, 'damaged');
  assert(trigOther.type === 'trigger' && trigOther.trigger === 'damaged', '选择其它时机 → 自动切触发技');
  const trigLocked = applyComposerTriggerChange({ type: 'locked', trigger: 'damaged', forced: true }, 'phaseUseBegin');
  assert(trigLocked.type === 'locked' && trigLocked.forced === true, '手动锁定技在切时机时保持锁定');
  const typeActive = applyComposerTypeChange({ type: 'trigger', trigger: 'damaged', forced: true }, 'active');
  assert(typeActive.type === 'active' && typeActive.trigger === 'phaseUseBegin'
    && typeActive.forced === false, '切主动技：phaseUseBegin + forced=false');
  const typeLocked = applyComposerTypeChange({ type: 'active', trigger: 'phaseUseBegin', forced: false }, 'locked');
  assert(typeLocked.type === 'locked' && typeLocked.forced === true
    && typeLocked.trigger !== 'phaseUseBegin', '切锁定技：forced=true 并补触发时机');
  const typeBack = applyComposerTypeChange(typeLocked, 'trigger');
  assert(typeBack.type === 'trigger' && typeBack.forced === false, '锁定技切回触发技 → 可询问');

  const editActive = normalizeEditorSkillType({
    type: 'trigger', triggerTiming: 'damaged', forced: false,
  }, 'active');
  assert(editActive.type === 'active' && editActive.triggerTiming === ''
    && editActive.forced === false, '编辑器切主动技：清空触发时机并 forced=false');
  const editLocked = normalizeEditorSkillType(editActive, 'locked');
  assert(editLocked.type === 'locked' && editLocked.forced === true
    && !!editLocked.triggerTiming, '编辑器切锁定技：forced=true 且保留触发时机');
  const editTrigger = normalizeEditorSkillType(editLocked, 'trigger');
  assert(editTrigger.type === 'trigger' && editTrigger.forced === false
    && editTrigger.triggerTiming !== '', '编辑器切触发技：补齐触发时机');

  const baseSkill = {
    name: '测试技', type: 'active', trigger: 'phaseUseBegin', source: 'player',
    conditions: [], cost: 'none', effects: [{ type: 'draw', value: 1 }],
    frequency: 'turn', forced: false,
  };
  const payloadActive = buildPayload(baseSkill);
  assert(payloadActive.type === 'active' && payloadActive.enable === 'phaseUse'
    && !('triggerTiming' in payloadActive) && payloadActive.forced === false,
  'buildPayload：active 输出 enable phaseUse，无 triggerTiming');
  const payloadTrigger = buildPayload({ ...baseSkill, type: 'trigger', trigger: 'damaged', forced: false });
  assert(payloadTrigger.type === 'trigger' && payloadTrigger.triggerTiming === 'damaged'
    && !('enable' in payloadTrigger) && payloadTrigger.forced === false,
  'buildPayload：trigger 输出 triggerTiming，无 enable');
  const payloadLocked = buildPayload({ ...baseSkill, type: 'locked', trigger: 'damaged', forced: true });
  assert(payloadLocked.type === 'locked' && payloadLocked.forced === true
    && payloadLocked.triggerTiming === 'damaged' && !('enable' in payloadLocked),
  'buildPayload：locked forced=true 且带 triggerTiming');

  const typeInfoActive = skillTypeInfo({ id: 'a', type: 'active', triggerTiming: '' });
  const typeInfoTrigger = skillTypeInfo({ id: 'b', type: 'trigger', triggerTiming: 'damaged' });
  const typeInfoLocked = skillTypeInfo({ id: 'c', type: 'locked', triggerTiming: 'damaged', forced: true });
  assert(typeInfoActive.label === '主动' && typeInfoActive.canActivate === true
    && typeInfoTrigger.label === '触发' && typeInfoTrigger.canActivate === false
    && typeInfoLocked.label === '锁定' && typeInfoLocked.passive === true,
  '技能类型展示信息：主动可发动，触发/锁定被动');
  assert(SKILL_TYPE_META.active.behavior.includes('不会自动触发')
    && SKILL_TYPE_META.trigger.behavior.includes('被动触发')
    && SKILL_TYPE_META.locked.behavior.includes('自动生效'), '技能类型说明文案完整');

  const typedSkillsPlayer = {
    id: 'sk-p1', name: '技能测试', seatNum: 0, isAI: false, status: 'alive',
    hp: 4, maxHp: 4, hujia: 0, handCards: [], handCardCount: 0,
    equips: {}, judgeCards: [],
    skills: [
      { id: 's-active', name: '烈火', description: '主动测试', type: 'active', triggerTiming: '', forced: false, usable: 1 },
      { id: 's-trigger', name: '铁壁', description: '触发测试', type: 'trigger', triggerTiming: 'damaged', forced: false, usable: 1 },
      { id: 's-locked', name: '不屈', description: '锁定测试', type: 'locked', triggerTiming: 'dying', forced: true, usable: 1 },
    ],
    usedJiu: false,
  };
  const selfSkillHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: typedSkillsPlayer, showDistance: false,
  }));
  for (const text of ['主动', '触发', '锁定', 'skill-type-active', 'skill-activable']) {
    assert(selfSkillHtml.includes(text), `SelfCharacterCard 技能徽标含「${text}」`);
  }
  assert(selfSkillHtml.includes('出牌阶段可发动'), '主动技 title 提示出牌阶段可发动');
  const areaSkillHtml = renderToString(React.createElement(PlayerArea, {
    player: typedSkillsPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  }));
  assert(areaSkillHtml.includes('主动') && areaSkillHtml.includes('触发')
    && areaSkillHtml.includes('锁定') && areaSkillHtml.includes('skill-type-badge'),
  'PlayerArea 技能 chip 显示类型徽标');

  renderPage('SkillEditor(类型说明)', React.createElement(SkillEditor, { navigate: noop }),
    ['技能类型', '满足触发时机时被动触发', '锁定技']);
  renderPage('SkillComposer(类型联动)', React.createElement(SkillComposer, { onApply: noop }), [
    '主动技（出牌阶段点按钮，不会自动触发）',
    '触发技（满足条件时被动触发，可询问）',
    '锁定技（自动生效不询问）',
    'composer-type-hint',
  ]);

  const typedSkillView = serializePlayerPublic(typedSkillsPlayer);
  const firstSkill = typedSkillView.skills[0];
  assert(firstSkill.type === 'active' && firstSkill.triggerTiming === ''
    && firstSkill.forced === false && firstSkill.usable === 1,
  '联机序列化 skills 含 type/triggerTiming/forced/usable');
  assert(typedSkillView.skills[2].type === 'locked' && typedSkillView.skills[2].forced === true,
    '序列化锁定技字段正确');

  const autoTriggerStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(readDefaultAutoTrigger(autoTriggerStorage) === false, '默认自动触发关闭');
  assert(saveDefaultAutoTrigger(true, autoTriggerStorage) === true
    && readDefaultAutoTrigger(autoTriggerStorage) === true, '保存并读取自动触发设置');
  assert(normalizeAutoTrigger('yes') === false && normalizeAutoTrigger(true) === true,
    '自动触发值严格布尔归一化');
  const storeSrcAuto = readFileSync('src/store/gameStore.js', 'utf8');
  assert(storeSrcAuto.includes('game.config.autoTrigger') && storeSrcAuto.includes('lastAutoTrigger'),
    'store 写入 game.config.autoTrigger 并保留 lastAutoTrigger');
  try {
    await useGameStore.getState().startGame(
      [{ name: 'A', isAI: true, team: null }, { name: 'B', isAI: true, team: null }],
      77, { teamMode: 'ffa', autoTrigger: true },
    );
    assert(useGameStore.getState().game?.config?.autoTrigger === true
      && useGameStore.getState().lastAutoTrigger === true,
    'store.startGame 写入 autoTrigger');
    useGameStore.getState().initGame();
  } catch (e) {
    assert(false, 'store.startGame autoTrigger 路径异常', e.message);
  }

  const appCssSkill = readFileSync('src/App.css', 'utf8');
  assert(appCssSkill.includes('.skill-type-badge') && appCssSkill.includes('.skill-type-badge.active')
    && appCssSkill.includes('.skill-type-badge.trigger')
    && appCssSkill.includes('.skill-type-badge.locked'), 'App.css 提供技能类型徽标样式');
  assert(appCssSkill.includes('.composer-type-hint') && appCssSkill.includes('.skill-type-hint'),
    'App.css 提供类型说明小字样式');

  console.log('\n[31] 卡牌哑光纸墨质感 + 丝滑 tilt');
  const testCard = {
    id: 'card1', name: '杀', suit: 'spade', number: 7, numberDisplay: '7', type: 'basic',
  };
  renderPage('CardFace(纸墨质感)', React.createElement(CardFace, { card: testCard }), [
    'card-grain', 'card-frame', 'card-name', 'card-seal', '杀',
  ]);
  const cardFaceHtml = renderToString(React.createElement(CardFace, { card: testCard }));
  assert(!cardFaceHtml.includes('card-shine'), 'CardFace 不再包含 card-shine 扫光');
  const cardFaceSrc = readFileSync('src/components/GameBoard/CardFace.jsx', 'utf8');
  assert(cardFaceSrc.includes('card-grain') && cardFaceSrc.includes('card-frame')
    && !cardFaceSrc.includes('card-shine'), 'CardFace 新结构：纤维层 + 双层框，无扫光');

  assert(computeCardTilt(50, 50, { left: 0, top: 0, width: 100, height: 100 }).x === 0
    && computeCardTilt(50, 50, { left: 0, top: 0, width: 100, height: 100 }).y === 0,
  'computeCardTilt：中心为 0');
  const rightTilt = computeCardTilt(100, 50, { left: 0, top: 0, width: 100, height: 100 }, 4);
  assert(rightTilt.x === 4 && rightTilt.y === 0, 'computeCardTilt：右边缘 = +max');
  assert(computeCardTilt(0, 50, { left: 0, top: 0, width: 100, height: 100 }, 4).x === -4,
    'computeCardTilt：左边缘 = -max');
  assert(computeCardTilt(50, 0, { left: 0, top: 0, width: 100, height: 100 }, 4).y === 4,
    'computeCardTilt：上边缘 = +max（rotateX）');
  const cornerTilt = computeCardTilt(100, 0, { left: 0, top: 0, width: 100, height: 100 }, 4);
  assert(Math.abs(cornerTilt.x) <= 4 && Math.abs(cornerTilt.y) <= 4
    && cornerTilt.x === 4 && cornerTilt.y === 4, 'computeCardTilt：对角线限幅在 max 内');
  assert(computeCardTilt(100, 50, { left: 0, top: 0, width: 100, height: 100 }, 6).x === 6,
    'computeCardTilt：支持自定义最大角度');
  assert(computeCardTilt(100, 50, { left: 0, top: 0, width: 100, height: 100 }, 100).x === 12,
    'computeCardTilt：最大角度 clamp 到 12');
  assert(computeCardTilt(50, 50, null) .x === 0
    && computeCardTilt(50, 50, { left: 0, top: 0, width: 0, height: 0 }).y === 0
    && computeCardTilt(NaN, 50, { left: 0, top: 0, width: 100, height: 100 }).x === 0,
  'computeCardTilt：非法输入安全归零');
  assert(CARD_TILT_MAX_DEG === 4, '默认最大 tilt 角度为 4°');

  assert(shouldEnableCardTilt({ pointerType: 'mouse', width: 1440 }) === true,
    '桌面鼠标启用 tilt');
  assert(shouldEnableCardTilt({ pointerType: 'touch' }) === false, '触摸不启用 tilt');
  assert(shouldEnableCardTilt({ pointerType: 'pen' }) === false, '手写笔不启用 tilt');
  assert(shouldEnableCardTilt({ pointerType: 'mouse', reducedMotion: true }) === false,
    'reduced-motion 不启用 tilt');
  assert(shouldEnableCardTilt({ pointerType: 'mouse', dragging: true }) === false
    && shouldEnableCardTilt({ pointerType: 'mouse', flipping: true }) === false,
  '拖拽 / FLIP 期间禁用 tilt');
  assert(shouldEnableCardTilt({ pointerType: 'mouse', width: 390 }) === false,
    '手机窄屏不启用 tilt');

  const appCssCard = readFileSync('src/App.css', 'utf8');
  assert(appCssCard.includes('--card-paper-light:') && appCssCard.includes('--card-paper:'),
    'App.css 含新纸色变量');
  assert(appCssCard.includes('feTurbulence') && appCssCard.includes('mix-blend-mode: multiply'),
    'App.css 含 feTurbulence 纸张纤维 + multiply');
  assert(appCssCard.includes('.card-grain') && appCssCard.includes('opacity: 0.06'),
    'App.css 含纸纹层低透明度');
  assert(appCssCard.includes('.card-frame') && appCssCard.includes('--card-gold-line'),
    'App.css 含墨线/金线双层框');
  assert(appCssCard.includes('0 1px 1px rgba(0, 0, 0, 0.26)')
    && appCssCard.includes('0 22px 40px rgba(0, 0, 0, 0.16)'),
  'App.css 含分层柔和阴影');
  assert(appCssCard.includes('--tilt-x') && appCssCard.includes('--tilt-y')
    && appCssCard.includes('rotateX(var(--tilt-y))'), 'App.css 含 tilt CSS 变量与 3D 旋转');
  assert(!appCssCard.includes('cardShine') && !appCssCard.includes('.card-shine'),
    'App.css 已移除塑料扫光 keyframes/类');
  assert(appCssCard.includes('.game-card.selected') && appCssCard.includes('rgba(201, 169, 79, 0.7)'),
    '选中态为金线 + 暖光晕');
  assert(appCssCard.includes('prefers-reduced-motion') && appCssCard.includes('--tilt-x: 0deg !important'),
    'tilt 含 reduced-motion 降级');
  const handZoneSrc = readFileSync('src/components/GameBoard/HandZone.jsx', 'utf8');
  assert(handZoneSrc.includes('computeCardTilt') && handZoneSrc.includes('--tilt-x')
    && handZoneSrc.includes('onPointerMove') && handZoneSrc.includes('onPointerLeave'),
  'HandZone pointermove 写入 tilt 变量并在离开时复位');
  const playerAreaSrc = readFileSync('src/components/GameBoard/PlayerArea.jsx', 'utf8');
  assert(playerAreaSrc.includes('card-backs') && playerAreaSrc.includes('mini-back')
    && playerAreaSrc.includes('#1a2620') && playerAreaSrc.includes('rgba(184, 147, 78, 0.26)'),
  '对手牌背含哑光墨绿纸纹 + 金色回纹');
  const backPlayer = {
    id: 'back-p1', name: '对手', seatNum: 1, isAI: true, status: 'alive',
    hp: 4, maxHp: 4, handCardCount: 3, handCards: [],
    equips: {}, judgeCards: [], skills: [], usedJiu: false,
  };
  renderPage('PlayerArea(牌背质感)', React.createElement(PlayerArea, {
    player: backPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  }), ['card-backs', 'mini-back', '手牌 3']);
  assert(appCssCard.includes('.game-card:hover') && appCssCard.includes('--card-lift: -6px'),
    'hover 抬升仍保留');
  assert(appCssCard.includes('.hand-zone .game-card:hover')
    || readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8').includes('--card-lift: -6px'),
  '手牌 hover 样式仍存在');

  console.log('\n[32] AI 绘画立绘：provider / 安全 / 面板 / 头像');
  assert(ART_PROVIDERS.length === 5
    && ART_PROVIDERS.map(p => p.id).join(',') === 'stable-horde,pollinations,huggingface,local-sd,custom',
  'provider registry 含 Stable Horde / Pollinations / Hugging Face / 本地 SD / 自定义');
  assert(DEFAULT_PROVIDER === 'stable-horde' && getArtProvider().id === 'stable-horde',
    '默认 provider 为 Stable Horde');
  assert(ART_STYLES.length >= 4 && ART_STYLES.some(s => s.label === '水墨国风')
    && ART_STYLES.some(s => s.label === '工笔重彩'), '风格预设含水墨国风/工笔重彩');
  assert(ART_SIZES.some(s => s.width === 768 && s.height === 1024), '尺寸预设含 768×1024');

  const fullPrompt = buildPrompt({ prompt: '青龙偃月刀', characterName: '关羽', style: 'ink' });
  assert(fullPrompt.startsWith(SAFETY_PREFIX.trim())
    && fullPrompt.includes('关羽') && fullPrompt.includes('Chinese ink wash painting')
    && fullPrompt.includes('青龙偃月刀'), '正向提示词含安全前缀/武将名/风格词');
  const longPrompt = buildPrompt({ prompt: '剑'.repeat(1200), characterName: '关羽' });
  assert(longPrompt.length <= 600, '提示词长度限制在 600 内');
  const fullNegative = buildNegative('extra arms');
  assert(fullNegative.includes('nsfw') && fullNegative.includes('lowres')
    && fullNegative.includes('bad anatomy') && fullNegative.includes('watermark')
    && fullNegative.includes('extra arms'), '负面提示词默认含 nsfw/lowres/bad anatomy/watermark');
  assert(DEFAULT_NEGATIVE.includes('watermark'), '默认负面词包含 watermark');
  assert(suggestPrompt({ name: '关羽', group: 'shu', description: '武圣' }).includes('关羽')
    && suggestPrompt({ name: '关羽', group: 'shu' }).includes('蜀势力'),
  '提示词按武将名/势力自动预填');

  const pollReq = buildArtRequest({
    provider: 'pollinations', prompt: '青龙偃月刀', characterName: '关羽',
    width: 768, height: 1024, seed: 42,
  });
  assert(pollReq.ok && pollReq.method === 'GET'
    && pollReq.url.startsWith('https://image.pollinations.ai/prompt/')
    && pollReq.url.includes('width=768') && pollReq.url.includes('height=1024')
    && pollReq.url.includes('seed=42') && pollReq.url.includes('nologo=true')
    && pollReq.url.includes('model=flux') && pollReq.responseType === 'url',
  'Pollinations 请求：URL 编码 + 尺寸/seed/nologo/model 参数');
  assert(decodeURIComponent(pollReq.url.split('/prompt/')[1].split('?')[0]).includes('关羽'),
    'Pollinations 提示词已 URL 编码');
  assert(buildArtRequest({ provider: 'pollinations', prompt: '' }).ok === false,
    '空提示词拒绝生成');

  const hfNoKey = buildArtRequest({ provider: 'huggingface', prompt: '关羽' });
  assert(hfNoKey.ok === false && hfNoKey.error.includes('token'), 'Hugging Face 缺 token 给出中文提示');
  const hfReq = buildArtRequest({
    provider: 'huggingface', prompt: '关羽',
    config: { huggingfaceToken: 'hf_test', hfModel: 'black-forest-labs/FLUX.1-schnell' },
  });
  assert(hfReq.ok && hfReq.method === 'POST'
    && hfReq.url.includes('black-forest-labs/FLUX.1-schnell')
    && hfReq.headers.Authorization === 'Bearer hf_test'
    && hfReq.body.inputs.includes('关羽') && hfReq.responseType === 'blob',
  'Hugging Face 请求：Bearer token + model + inputs blob');
  const sdReq = buildArtRequest({ provider: 'local-sd', prompt: '关羽' });
  assert(sdReq.ok && sdReq.url === 'http://127.0.0.1:7860/sdapi/v1/txt2img'
    && sdReq.body.prompt.includes('关羽') && sdReq.body.negative_prompt.includes('nsfw')
    && sdReq.body.width === 768 && sdReq.body.height === 1024 && sdReq.responseType === 'json',
  '本地 SD 请求：txt2img + negative_prompt + 尺寸');
  assert(buildArtRequest({ provider: 'local-sd', prompt: '关羽', config: { localBaseUrl: 'bad' } }).ok === false,
    '本地 SD 非法地址拒绝');
  const customReq = buildArtRequest({
    provider: 'custom', prompt: '关羽',
    config: { customBaseUrl: 'https://api.example.com', customApiKey: 'sk-test', customModel: 'flux-test' },
  });
  assert(customReq.ok && customReq.url === 'https://api.example.com/v1/images/generations'
    && customReq.headers.Authorization === 'Bearer sk-test'
    && customReq.body.size === '768x1024' && customReq.body.response_format === 'b64_json',
  '自定义 OpenAI 兼容请求：baseUrl/key/model + b64_json');
  assert(buildArtRequest({ provider: 'custom', prompt: '关羽' }).ok === false
    && buildArtRequest({ provider: 'custom', prompt: '关羽', config: { customBaseUrl: 'https://x' } }).error.includes('apiKey'),
  '自定义 provider 缺配置时给出中文提示');

  assert(normalizeArtSize(100, 200).width === 256 && normalizeArtSize(5000, 5000).width === 1536
    && normalizeArtSize(768, 1024).height === 1024, '尺寸校验/clamp');
  assert(normalizeSeed('42') === 42 && normalizeSeed(-5) === 0
    && normalizeSeed(2e9) === 999999999, 'seed 校验');
  assert(isSafeImageUrl('https://x/a.jpg') && isSafeImageUrl('http://x/a.png')
    && isSafeImageUrl('data:image/png;base64,AAAA')
    && !isSafeImageUrl('javascript:alert(1)') && !isSafeImageUrl('data:text/html,<b>x</b>')
    && !isSafeImageUrl('ftp://x/a.jpg') && !isSafeImageUrl(''),
  '图片 URL 白名单：http(s)/data:image，拒绝 javascript/data:text/html');

  const artStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(readArtConfig(artStorage).provider === 'stable-horde', '读取 AI 配置默认 Stable Horde');
  assert(saveArtConfig({ provider: 'huggingface', huggingfaceToken: 'hf_x', imageUrl: 'leak' }, artStorage) === true,
    '保存 AI 配置到 localStorage');
  const loadedArtCfg = readArtConfig(artStorage);
  assert(loadedArtCfg.provider === 'huggingface' && loadedArtCfg.huggingfaceToken === 'hf_x'
    && loadedArtCfg.imageUrl === undefined, 'AI 配置不写入武将导出（仅白名单字段）');
  artStorage.setItem(ART_CONFIG_KEY, '{bad json');
  assert(readArtConfig(artStorage).provider === 'stable-horde', '损坏 AI 配置回退默认');

  const pollFetch = async () => ({ ok: true, status: 200 });
  const pollResult = await generateArt({ provider: 'pollinations', prompt: '关羽' }, { fetchImpl: pollFetch });
  assert(pollResult.ok && pollResult.imageUrl.startsWith('https://image.pollinations.ai/prompt/'),
    'generateArt：Pollinations 直接返回图片 URL');
  const blobResult = await generateArt(
    { provider: 'huggingface', prompt: '关羽', config: { huggingfaceToken: 'hf_x' } },
    {
      fetchImpl: async () => ({ ok: true, status: 200, blob: async () => ({ type: 'image/png' }) }),
      blobToDataUrl: async () => 'data:image/png;base64,AAAA',
    },
  );
  assert(blobResult.ok && blobResult.imageUrl === 'data:image/png;base64,AAAA',
    'generateArt：Hugging Face blob → dataURL');
  const sdResult = await generateArt({ provider: 'local-sd', prompt: '关羽' }, {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ images: ['abcd'] }) }),
  });
  assert(sdResult.ok && sdResult.imageUrl === 'data:image/png;base64,abcd',
    'generateArt：本地 SD base64 → dataURL');
  const customResult = await generateArt(
    { provider: 'custom', prompt: '关羽', config: { customBaseUrl: 'https://x', customApiKey: 'k', customModel: 'm' } },
    { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [{ b64_json: 'zzz' }] }) }) },
  );
  assert(customResult.ok && customResult.imageUrl === 'data:image/png;base64,zzz',
    'generateArt：自定义 provider b64_json → dataURL');
  const err401 = await generateArt(
    { provider: 'huggingface', prompt: '关羽', config: { huggingfaceToken: 'bad' } },
    { fetchImpl: async () => ({ ok: false, status: 401 }) },
  );
  assert(err401.ok === false && err401.error.includes('token'), 'generateArt：401 token 错误中文提示');
  const err429 = await generateArt(
    { provider: 'huggingface', prompt: '关羽', config: { huggingfaceToken: 'x' } },
    { fetchImpl: async () => ({ ok: false, status: 429 }) },
  );
  assert(err429.ok === false && err429.error.includes('429'), 'generateArt：429 频率提示');
  const err503 = await generateArt(
    { provider: 'huggingface', prompt: '关羽', config: { huggingfaceToken: 'x' } },
    { fetchImpl: async () => ({ ok: false, status: 503 }) },
  );
  assert(err503.ok === false && err503.error.includes('503'), 'generateArt：503 繁忙提示');
  const netErr = await generateArt(
    { provider: 'huggingface', prompt: '关羽', config: { huggingfaceToken: 'x' } },
    { fetchImpl: async () => { throw new Error('offline'); } },
  );
  assert(netErr.ok === false && netErr.error.includes('生成失败'), 'generateArt：网络异常安全降级');

  assert(validateImageFile(null).ok === false && validateImageFile({ type: 'text/plain', size: 10 }).ok === false,
    '图片导入：拒绝非图片/空文件');
  assert(validateImageFile({ type: 'image/png', size: 9 * 1024 * 1024 }).ok === false,
    '图片导入：>8MB 拒绝');
  assert(validateImageFile({ type: 'image/jpeg', size: 1024 }).ok === true, '图片导入：合法 JPEG 通过');
  assert(MAX_IMPORT_BYTES === 8 * 1024 * 1024, '图片导入大小上限 8MB');
  assert(fitImageSize(1536, 2048).width === 768 && fitImageSize(1536, 2048).height === 1024,
    '图片导入：等比压缩到 768×1024');

  const artHtml = renderToString(React.createElement(ArtStudio, {
    name: '关羽', group: 'shu', description: '武圣', imageUrl: 'https://example.com/guanyu.jpg',
  }));
  for (const text of ['AI 生成立绘', '导入本地图片', '使用图片 URL', '应用为立绘', '重新生成',
    'Pollinations', 'Hugging Face', '本地 Stable Diffusion', '自定义',
    '水墨国风', '工笔重彩', '负面提示词', '安全提示', '仅保存在本机 localStorage']) {
    assert(artHtml.includes(text), `ArtStudio 含「${text}」`);
  }
  assert(artHtml.includes('<img') && artHtml.includes('example.com/guanyu.jpg'),
    'ArtStudio 预览当前立绘使用 img');
  renderPage('CharacterEditor(立绘区)', React.createElement(CharacterEditor, { navigate: noop }),
    ['武将编辑器', '立绘', 'AI 生成立绘', '应用为立绘', '导入本地图片']);
  const portraitImg = renderToString(React.createElement(Portrait, {
    src: 'https://example.com/p.png', name: '关羽',
  }));
  assert(portraitImg.includes('<img') && portraitImg.includes('https://example.com/p.png'),
    'Portrait 有安全 imageUrl 输出 img');
  const portraitUnsafe = renderToString(React.createElement(Portrait, {
    src: 'javascript:alert(1)', name: '关羽',
  }));
  assert(!portraitUnsafe.includes('<img') && portraitUnsafe.includes('关'),
    'Portrait 拒绝 javascript: 并回退首字');
  const portraitFallback = renderToString(React.createElement(Portrait, { name: '关羽' }));
  assert(!portraitFallback.includes('<img') && portraitFallback.includes('关'),
    'Portrait 无图回退名字首字');

  const imgPlayer = {
    id: 'img-p1', name: '关羽', seatNum: 0, isAI: false, status: 'alive',
    hp: 4, maxHp: 4, hujia: 0, handCards: [], handCardCount: 0,
    equips: {}, judgeCards: [], skills: [], usedJiu: false,
    character: { id: 'guan', name: '关羽', group: 'shu', imageUrl: 'https://example.com/guan.jpg' },
  };
  const areaImgHtml = renderToString(React.createElement(PlayerArea, {
    player: imgPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  }));
  const selfImgHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: imgPlayer, showDistance: false,
  }));
  assert(areaImgHtml.includes('<img') && areaImgHtml.includes('example.com/guan.jpg'),
    'PlayerArea 渲染武将立绘 img');
  assert(selfImgHtml.includes('<img') && selfImgHtml.includes('example.com/guan.jpg'),
    'SelfCharacterCard 渲染武将立绘 img');
  const noImgPlayer = { ...imgPlayer, character: { id: 'guan', name: '关羽', group: 'shu' } };
  assert(!renderToString(React.createElement(PlayerArea, {
    player: noImgPlayer, isSelf: false, isCurrent: false, selectable: false,
    teamMode: 'ffa', showDistance: false,
  })).includes('<img'), 'PlayerArea 无立绘回退首字');

  const appCssArt = readFileSync('src/App.css', 'utf8');
  assert(appCssArt.includes('.portrait img') && appCssArt.includes('object-fit: cover'),
    'App.css 头像/立绘 object-fit cover');
  assert(appCssArt.includes('.art-studio') && appCssArt.includes('.art-security'),
    'App.css 含 AI 立绘面板样式');

  console.log('\n[33] Stable Horde：默认 provider / 轮询 / 排队提示');
  const hordeSpec = ART_PROVIDERS.find(p => p.id === 'stable-horde');
  assert(hordeSpec && hordeSpec.free === true && hordeSpec.queue === true
    && hordeSpec.needsKey === false, 'Stable Horde 标记为免费·排队·无需 Key');
  assert(STABLE_HORDE_ANON_KEY === '0000000000'
    && STABLE_HORDE_CLIENT_AGENT.includes('CardGameMaker'), 'Stable Horde 匿名 key/Client-Agent 常量');
  const pollSpec = ART_PROVIDERS.find(p => p.id === 'pollinations');
  assert(pollSpec.desc.includes('占位') && pollSpec.desc.includes('限流'),
    'Pollinations 描述警告匿名占位/限流');

  const hordeReq = buildArtRequest({
    provider: 'stable-horde', prompt: '青龙偃月刀', characterName: '关羽',
    width: 768, height: 1024, seed: 42,
  });
  assert(hordeReq.ok && hordeReq.mode === 'horde'
    && hordeReq.submitUrl === 'https://stablehorde.net/api/v2/generate/async'
    && hordeReq.checkUrlBase === 'https://stablehorde.net/api/v2/generate/check'
    && hordeReq.statusUrlBase === 'https://stablehorde.net/api/v2/generate/status',
  'buildArtRequest：Stable Horde 提交/轮询/状态地址');
  assert(hordeReq.headers.apikey === '0000000000'
    && hordeReq.headers['Client-Agent'] === STABLE_HORDE_CLIENT_AGENT,
  'buildArtRequest：Stable Horde 匿名 key 与 Client-Agent');
  assert(hordeReq.body.prompt.includes('关羽') && hordeReq.body.params.width === 512
    && hordeReq.body.params.height === 768 && hordeReq.body.params.steps === 8
    && hordeReq.body.nsfw === false && hordeReq.body.censor_nsfw === true
    && hordeReq.body.r2 === false && hordeReq.budgetLimited === true,
  'buildArtRequest：匿名 768×1024 自动 clamp 到 512×768/8 步');
  assert(hordeReq.seed === 42 && hordeReq.body.params.seed === '42'
    && hordeReq.timeoutMs === 600000 && hordeReq.pollIntervalMs >= 4000,
  'buildArtRequest：seed 归一与 600s 超时/4s+ 轮询');
  const hordeKeyReq = buildArtRequest({
    provider: 'stable-horde', prompt: '关羽', width: 768, height: 1024,
    config: { hordeKey: 'my-key-123' },
  });
  assert(hordeKeyReq.headers.apikey === 'my-key-123' && hordeKeyReq.budgetLimited === false
    && hordeKeyReq.body.params.width === 768 && hordeKeyReq.body.params.height === 1024
    && hordeKeyReq.body.params.steps === 8, 'hordeKey 覆盖匿名 key 且保留大尺寸');
  assert(buildArtRequest({ provider: 'stable-horde', prompt: '' }).ok === false,
    'Stable Horde 空提示词拒绝');

  const pollTokenReq = buildArtRequest({
    provider: 'pollinations', prompt: '关羽', config: { pollinationsToken: 'tok-1' },
  });
  assert(pollTokenReq.url.includes('token=tok-1'), 'Pollinations 可选 token 透传');

  // generateArt：submit → check(false) → check(true) → status
  const hordeCalls = [];
  const hordeResponses = [
    { ok: true, status: 202, json: async () => ({ id: 'job-1' }) },
    { ok: true, status: 200, json: async () => ({ done: false, queue_position: 3, wait_time: 40, processing: false }) },
    { ok: true, status: 200, json: async () => ({ done: true, processing: false }) },
    { ok: true, status: 200, json: async () => ({ generations: [{ img: 'https://cdn.example.com/a.webp' }] }) },
  ];
  const progressEvents = [];
  const hordeResult = await generateArt(
    { provider: 'stable-horde', prompt: '关羽', onProgress: (p) => progressEvents.push(p) },
    {
      fetchImpl: async (url, options) => {
        hordeCalls.push({ url, method: options?.method, headers: options?.headers });
        return hordeResponses.shift() || { ok: false, status: 500 };
      },
      sleep: async () => {},
    },
  );
  assert(hordeResult.ok && hordeResult.imageUrl === 'https://cdn.example.com/a.webp',
    'generateArt：Stable Horde 轮询后返回图片 URL');
  assert(hordeCalls.length === 4
    && hordeCalls[0].url === 'https://stablehorde.net/api/v2/generate/async'
    && hordeCalls[0].method === 'POST'
    && hordeCalls[1].url === 'https://stablehorde.net/api/v2/generate/check/job-1'
    && hordeCalls[3].url === 'https://stablehorde.net/api/v2/generate/status/job-1',
  'generateArt：Stable Horde 依次 submit→check→status');
  assert(progressEvents.some(p => p.stage === 'submit')
    && progressEvents.some(p => p.stage === 'queue' && p.queuePosition === 3)
    && progressEvents.some(p => p.stage === 'download'),
  'generateArt：onProgress 上报提交/排队位置/下载');

  const hordeBase64 = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    {
      fetchImpl: async (url) => {
        if (url.includes('/generate/async')) return { ok: true, status: 202, json: async () => ({ id: 'job-b64' }) };
        if (url.includes('/generate/check/')) return { ok: true, status: 200, json: async () => ({ done: true }) };
        if (url.includes('/generate/status/')) return { ok: true, status: 200, json: async () => ({ generations: [{ img: `UklGRg${'A'.repeat(200)}` }] }) };
        return { ok: false, status: 500 };
      },
      sleep: async () => {},
    },
  );
  assert(hordeBase64.ok && hordeBase64.imageUrl.startsWith('data:image/webp;base64,UklGRg'),
    'generateArt：Stable Horde base64 转为可持久 dataURL');

  const hordeDataUrl = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    {
      fetchImpl: async () => { throw new Error('offline'); },
      sleep: async () => {},
    },
  );
  assert(hordeDataUrl.ok === false && hordeDataUrl.error.includes('Stable Horde'),
    'generateArt：Stable Horde 网络异常中文错误');
  const horde401 = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    { fetchImpl: async () => ({ ok: false, status: 401 }), sleep: async () => {} },
  );
  assert(horde401.ok === false && horde401.error.includes('hordeKey'),
    'generateArt：Stable Horde 401 提示填写 hordeKey');
  const horde429 = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    { fetchImpl: async () => ({ ok: false, status: 429 }), sleep: async () => {} },
  );
  assert(horde429.ok === false && horde429.error.includes('429'),
    'generateArt：Stable Horde 429 频率提示');
  let fakeNow = 0;
  const hordeTimeout = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    {
      fetchImpl: async (url) => {
        if (url.includes('/generate/async')) return { ok: true, status: 202, json: async () => ({ id: 'job-t' }) };
        return { ok: true, status: 200, json: async () => ({ done: false, queue_position: 99, processing: false }) };
      },
      sleep: async () => { fakeNow += 120000; },
      now: () => fakeNow,
    },
  );
  assert(hordeTimeout.ok === false && hordeTimeout.error.includes('超时'),
    'generateArt：Stable Horde 排队超时中文提示');
  const hordeNoImg = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    {
      fetchImpl: async (url) => {
        if (url.includes('/generate/async')) return { ok: true, status: 202, json: async () => ({ id: 'job-n' }) };
        if (url.includes('/check/')) return { ok: true, status: 200, json: async () => ({ done: true }) };
        return { ok: true, status: 200, json: async () => ({ generations: [] }) };
      },
      sleep: async () => {},
    },
  );
  assert(hordeNoImg.ok === false && hordeNoImg.error.includes('没有返回图片'),
    'generateArt：Stable Horde 无图错误提示');

  assert(CUSTOM_PRESETS.length === 2
    && CUSTOM_PRESETS.some(p => p.label.includes('智谱'))
    && CUSTOM_PRESETS.some(p => p.label.includes('硅基流动')),
  '自定义 provider 提供智谱/硅基流动快捷预设');
  assert(customImagesEndpoint('https://open.bigmodel.cn/api/paas/v4')
    === 'https://open.bigmodel.cn/api/paas/v4/images/generations'
    && customImagesEndpoint('https://api.siliconflow.cn/v1')
    === 'https://api.siliconflow.cn/v1/images/generations'
    && customImagesEndpoint('https://api.example.com')
    === 'https://api.example.com/v1/images/generations',
  '自定义 OpenAI 兼容端点按版本号拼接');

  const hordeArtHtml = renderToString(React.createElement(ArtStudio, {
    name: '关羽', group: 'shu', description: '武圣',
  }));
  for (const text of ['Stable Horde', '排队', '免费', 'hordeKey', '匿名 512×768/8 步']) {
    assert(hordeArtHtml.includes(text), `ArtStudio 含「${text}」`);
  }
  assert(hordeArtHtml.includes('0000000000') && hordeArtHtml.includes('仅本地保存'),
    'ArtStudio 显示匿名 key 说明与本地保存提示');

  console.log('\n[34] 武将 · 卡牌工坊：布局 / 导入映射 / 保存 / 草稿');
  const blankForm = blankCharacterForm();
  assert(blankForm.name === '' && blankForm.hp === 3 && blankForm.skillIds.length === 0,
    '空白武将表单结构正确');
  assert(normalizeGroup('shu') === 'shu' && normalizeGroup('蜀') === 'shu'
    && normalizeGroup('unknown') === 'custom', '势力归一化：ID/中文/非法回退');
  assert(normalizeSex('female') === 'female' && normalizeSex('x') === 'male', '性别归一化');
  const clamped = normalizeCharacterForm({ name: ' 关羽 ', hp: 99, maxHp: 1, skillIds: ['a', 'a', '', null] });
  assert(clamped.name === '关羽' && clamped.hp === 9 && clamped.maxHp === 9
    && clamped.skillIds.length === 1, '表单归一化：trim/clamp/技能去重');

  const cardJson = {
    name: '关羽', type: 'basic', faction: 'shu', rarity: 'legendary',
    cost: 4, hp: 5, armor: 1, attackRange: 3,
    skills: [{ name: '武圣' }, { name: '不存在技能' }, { name: '单骑' }],
    brief: '武圣临阵', flavor: '青龙偃月，忠义千秋。',
    artist: '墨玉工坊', artUrl: 'https://example.com/guanyu.jpg',
    frame: 'jade', accent: '#5f8f7d', number: 'CGM-001',
  };
  assert(isCardEditorPayload(cardJson) === true && isGameCharacterPayload(cardJson) === false,
    '识别桌面卡牌 JSON');
  const mockStoreSkills = [
    { id: 'sk_wusheng', name: '武圣', type: 'active', description: '红牌当杀' },
    { id: 'sk_danqi', name: '单骑', type: 'trigger', description: '受伤摸牌' },
  ];
  assert(isGameCharacterPayload({ name: '关羽', skillIds: ['sk_wusheng'] }) === true,
    '识别游戏武将 JSON');
  const matched = matchSkillsByName(cardJson.skills, mockStoreSkills);
  assert(matched.skillIds.join(',') === 'sk_wusheng,sk_danqi'
    && matched.unmatched.join(',') === '不存在技能', '技能按名称匹配 + 未匹配收集');

  const importedCard = extractCharacterImport(cardJson, mockStoreSkills);
  assert(importedCard.ok && importedCard.format === 'card'
    && importedCard.form.name === '关羽' && importedCard.form.group === 'shu'
    && importedCard.form.hp === 5 && importedCard.form.maxHp === 5
    && importedCard.form.imageUrl === 'https://example.com/guanyu.jpg'
    && importedCard.form.skillIds.join(',') === 'sk_wusheng,sk_danqi'
    && importedCard.form.description.includes('青龙偃月'), '桌面卡牌 JSON → 游戏武将映射');
  assert(importedCard.unmatched.length === 1 && importedCard.unmatched[0] === '不存在技能',
    '导入未匹配技能提示数据');
  assert(importedCard.appearance.frame === 'jade' && importedCard.appearance.accent === '#5f8f7d',
    '桌面卡牌外观映射到预览');
  assert(importedCard.meta.number === 'CGM-001' && importedCard.meta.artist === '墨玉工坊',
    '桌面卡牌编号/画师映射');
  const cardUnsafe = extractCharacterImport({ ...cardJson, artUrl: 'javascript:alert(1)' }, mockStoreSkills);
  assert(cardUnsafe.ok && cardUnsafe.form.imageUrl === '', '桌面卡牌危险立绘 URL 被拒绝');
  const cardFaction = extractCharacterImport({ ...cardJson, faction: '魏' }, mockStoreSkills);
  assert(cardFaction.form.group === 'wei', '桌面卡牌中文势力映射');

  const gameJson = {
    id: 'g1', name: '赵云', sex: 'male', group: 'shu', hp: 4, maxHp: 4,
    skillIds: ['sk_wusheng'], description: '常胜将军', imageUrl: 'https://example.com/zhao.png',
  };
  const importedGame = extractCharacterImport(gameJson, mockStoreSkills);
  assert(importedGame.ok && importedGame.format === 'game'
    && importedGame.form.name === '赵云' && importedGame.form.id === 'g1'
    && importedGame.form.skillIds.join(',') === 'sk_wusheng'
    && importedGame.form.imageUrl === 'https://example.com/zhao.png', '游戏武将 JSON 直接载入');
  assert(extractCharacterImport({ foo: 1 }, mockStoreSkills).ok === false
    && extractCharacterImport([], mockStoreSkills).ok === false, '无法识别/非对象 JSON 报错');

  const exported = buildCharacterExport({
    id: 'g1', name: '赵云', sex: 'female', group: 'shu', hp: 4, maxHp: 5,
    skillIds: ['sk_wusheng'], description: '常胜将军', imageUrl: 'https://example.com/zhao.png',
    frame: 'jade', accent: '#5f8f7d',
  });
  assert(exported.name === '赵云' && exported.sex === 'female' && exported.maxHp === 5
    && exported.skillIds.join(',') === 'sk_wusheng' && exported.id === 'g1'
    && exported.frame === undefined && exported.accent === undefined,
  '导出游戏 Character 配置且不带预览外观字段');

  assert(buildCharacterSavePayload({ ...blankForm, name: '' }).ok === false,
    '空名称保存校验');
  const autoId = buildCharacterSavePayload({ ...blankForm, name: '关羽' }, { existingIds: [] });
  assert(autoId.ok && autoId.config.name === '关羽'
    && autoId.config.id.startsWith('custom_') && autoId.idCollision === false,
  '保存时自动生成 ID');
  const collide = buildCharacterSavePayload(
    { ...blankForm, name: '关羽', id: 'dup' }, { existingIds: ['dup'] },
  );
  assert(collide.ok && collide.idCollision === true && collide.config.id !== 'dup',
    '重复 ID 自动生成新 ID');
  const editSave = buildCharacterSavePayload(
    { ...blankForm, name: '关羽', id: 'ignored' }, { editingId: 'old-id', existingIds: ['old-id'] },
  );
  assert(editSave.ok && editSave.config.id === 'old-id', '编辑态保存沿用原 ID');

  assert(CHARACTER_DRAFT_KEY === 'cgm_character_draft_v2', '草稿 key 为 cgm_character_draft_v2');
  const wsStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(saveCharacterDraft({
    form: { ...blankForm, name: '关羽', hp: 5 },
    appearance: { frame: 'copper', accent: '#c9a757' },
    meta: { number: 'N-1', artist: '工坊' },
    editingId: 'e1',
  }, wsStorage) === true, '保存武将草稿');
  const loadedDraft = loadCharacterDraft(wsStorage);
  assert(loadedDraft.form.name === '关羽' && loadedDraft.form.hp === 5
    && loadedDraft.appearance.frame === 'copper' && loadedDraft.meta.number === 'N-1'
    && loadedDraft.editingId === 'e1', '读取武将草稿（表单/外观/编号）');
  wsStorage.setItem(CHARACTER_DRAFT_KEY, '{bad json');
  assert(loadCharacterDraft(wsStorage) === null, '损坏草稿安全回退');
  const initialWorkshop = buildWorkshopInitialState({ name: '测试', hp: 6 }, wsStorage);
  assert(initialWorkshop.form.name === '测试' && initialWorkshop.editingId === null,
    'initialForm 优先于草稿');

  const previewSkills = mockStoreSkills;
  const previewHtml = renderToString(React.createElement(CharacterCardPreview, {
    form: { ...blankForm, name: '关羽', group: 'shu', hp: 5, maxHp: 5, description: '武圣临阵', skillIds: ['sk_wusheng', 'sk_danqi'] },
    skills: previewSkills,
    appearance: { frame: 'gold', accent: '#a83a32' },
    meta: { number: 'CGM-001', artist: '墨玉工坊' },
  }));
  for (const text of ['关羽', '体力', '5', '武圣', '单骑', '主动', '触发', 'workshop-skill-block']) {
    assert(previewHtml.includes(text), `卡牌预览含「${text}」`);
  }
  const emptyPreviewHtml = renderToString(React.createElement(CharacterCardPreview, {
    form: blankForm, skills: [], appearance: {}, meta: {},
  }));
  assert(emptyPreviewHtml.includes('无名武将') && emptyPreviewHtml.includes('暂无技能'),
    '空武将预览显示占位名称与空技能提示');

  const prevSkills = useGameStore.getState().skills;
  try {
    useGameStore.setState({ skills: mockStoreSkills });
    renderPage('CharacterEditor(卡牌工坊)', React.createElement(CharacterEditor, {
      navigate: noop,
      initialForm: {
        id: 'g1', name: '关羽', sex: 'male', group: 'shu', hp: 5, maxHp: 5,
        description: '武圣临阵', skillIds: ['sk_wusheng', 'sk_danqi'],
        imageUrl: 'https://example.com/guanyu.jpg',
      },
    }), ['武将 · 卡牌工坊', '保存武将', '导入 JSON', '导出 JSON', '实时预览',
      '关羽', '体力', '已有武将', '卡面外观']);
  } finally {
    useGameStore.setState({ skills: prevSkills });
  }
  const editorSrc = readFileSync('src/components/Editor/CharacterEditor.jsx', 'utf8');
  assert(editorSrc.includes('addCharacter') && editorSrc.includes('updateCharacter')
    && editorSrc.includes('removeCharacter') && editorSrc.includes('ArtStudio'),
  '工坊保留 store 增删改与 ArtStudio 集成');

  console.log('\n[35] 字体动效 / 图标 / AI 入口 / AI 配音');
  for (const iconName of ['mic', 'voice', 'palette', 'stop', 'sparkle', 'volume']) {
    assert(ICON_NAMES.includes(iconName), `图标清单含「${iconName}」`);
  }
  const micIconHtml = renderToString(React.createElement(Icon, { name: 'mic', size: 18 }));
  const voiceIconHtml = renderToString(React.createElement(Icon, { name: 'voice', size: 18 }));
  const paletteIconHtml = renderToString(React.createElement(Icon, { name: 'palette', size: 18 }));
  const stopIconHtml = renderToString(React.createElement(Icon, { name: 'stop', size: 18 }));
  for (const html of [micIconHtml, voiceIconHtml, paletteIconHtml, stopIconHtml]) {
    assert(html.includes('aria-hidden="true"') && html.includes('stroke-width="1.7"')
      && html.includes('stroke="currentColor"'), '新图标 SSR 含 aria-hidden/currentColor/1.7');
  }

  renderPage('MainMenu(AI 立绘入口)', React.createElement(MainMenu, { navigate: noop }),
    ['AI 立绘', '速玩', '武将编辑器']);
  const mainMenuSrc = readFileSync('src/components/Menu/MainMenu.jsx', 'utf8');
  assert(mainMenuSrc.includes("navigate('editor', { focus: 'art' })"),
    '主菜单 AI 立绘携带 context.focus=art');

  const workshopArtHtml = renderToString(React.createElement(CharacterEditor, {
    navigate: noop,
    context: { focus: 'art' },
    initialForm: { name: '关羽', group: 'shu', hp: 5 },
  }));
  assert(/<section class="workshop-section open" data-section="art"/.test(workshopArtHtml),
    'context.focus=art 时立绘分区默认展开');
  for (const text of ['AI 立绘', 'AI 配音', 'AI 配音', '本地 GPT-SoVITS', '浏览器语音']) {
    assert(workshopArtHtml.includes(text), `工坊含「${text}」`);
  }

  const voiceStudioHtml = renderToString(React.createElement(VoiceStudio, {
    name: '关羽', skillNames: ['武圣', '单骑'],
  }));
  for (const text of ['AI 配音', '浏览器语音', '本地 GPT-SoVITS', '试听', 'start-voice.bat',
    '参考音频', '安全提示', '关羽，听我号令', '语速']) {
    assert(voiceStudioHtml.includes(text), `AI 配音面板含「${text}」`);
  }
  assert(voiceStudioHtml.includes('不会上传') && voiceStudioHtml.includes('本机服务'),
    'AI 配音包含本机处理安全提示');

  assert(VOICE_PROVIDERS.length === 3 && VOICE_PROVIDERS[0].id === 'browser'
    && VOICE_PROVIDERS[1].id === 'gpt-sovits' && VOICE_PROVIDERS[2].id === 'piper'
    && VOICE_PROVIDERS[2].needsRef === false && VOICE_PROVIDERS[2].local === true,
  '配音 provider 清单（浏览器/GPT-SoVITS/Piper）');
  assert(VOICE_CONFIG_KEY === 'cgm_voice_config', '配音配置 key 为 cgm_voice_config');
  assert(normalizeVoiceText('  你好，  世界  ') === '你好， 世界', '试听文本归一化');
  assert(normalizeVoiceText('甲'.repeat(300), 10).length === 10, '试听文本长度限制');
  assert(buildDefaultVoiceText('关羽', ['武圣']) === '关羽，听我号令：武圣！'
    && buildDefaultVoiceText('', []) === '武将，参战！', '默认试听文本按武将/技能生成');

  const voiceReq = buildVoiceRequest({
    text: '  关羽，参战！ ', refAudioPath: DEFAULT_VOICE_REF,
    promptText: '这是一段旁白。', speed: 1.5,
  });
  assert(voiceReq.ok && voiceReq.url === '/voice-api/tts' && voiceReq.method === 'POST'
    && voiceReq.headers['Content-Type'] === 'application/json', 'buildVoiceRequest URL/方法');
  assert(voiceReq.body.text === '关羽，参战！' && voiceReq.body.text_lang === 'zh'
    && voiceReq.body.ref_audio_path === DEFAULT_VOICE_REF
    && voiceReq.body.prompt_text === '这是一段旁白。'
    && voiceReq.body.media_type === 'wav' && voiceReq.body.streaming_mode === false
    && voiceReq.body.speed_factor === 1.5, 'buildVoiceRequest 请求字段');
  assert(buildVoiceRequest({ text: '' }).ok === false
    && buildVoiceRequest({ text: '测试', refAudioPath: '' }).ok === false
    && buildVoiceRequest({ text: '测试', refAudioPath: 'x', promptText: '' }).ok === false,
  'buildVoiceRequest 文本/参考音频/参考文本校验');
  assert(buildVoiceRequest({ text: '测试', apiBase: '/voice-api/' }).url === '/voice-api/tts'
    && buildVoiceRequest({ text: '测试', speed: 99 }).body.speed_factor === 2
    && buildVoiceRequest({ text: '测试', speed: 0.1 }).body.speed_factor === 0.5,
  'buildVoiceRequest API 前缀/语速范围');

  assert(mapVoiceError(503).includes('start-voice.bat'), '503 错误提示启动 start-voice.bat');
  assert(mapVoiceError(400).includes('参考音频'), '400 错误提示参考音频');
  assert(mapVoiceError(404).includes('接口'), '404 错误提示 API 地址');

  const voiceStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(saveVoiceConfig({ provider: 'gpt-sovits', rate: 1.3, speed: 0.8, refAudioPath: 'D:\\x\\ref.wav' }, voiceStorage) === true,
    '保存配音配置');
  const loadedVoiceConfig = readVoiceConfig(voiceStorage);
  assert(loadedVoiceConfig.provider === 'gpt-sovits' && loadedVoiceConfig.rate === 1.3
    && loadedVoiceConfig.speed === 0.8 && loadedVoiceConfig.refAudioPath === 'D:\\x\\ref.wav',
  '读取配音配置');
  voiceStorage.setItem(VOICE_CONFIG_KEY, '{bad');
  assert(readVoiceConfig(voiceStorage).provider === 'browser', '损坏配音配置安全回退');
  const normalizedConfig = normalizeVoiceConfig({ provider: 'gpt-sovits', rate: 9, pitch: -3, speed: 0.1 });
  assert(normalizedConfig.provider === 'gpt-sovits' && normalizedConfig.rate === 2
    && normalizedConfig.pitch === 0 && normalizedConfig.speed === 0.5, '配音配置数值范围归一化');

  const fakeScopeNoSpeech = {};
  assert(isSpeechSupported(fakeScopeNoSpeech) === false, '无声环境检测为不支持');
  const fakeVoices = [
    { name: 'English', lang: 'en-US', voiceURI: 'en' },
    { name: '中文女声', lang: 'zh-CN', voiceURI: 'zh' },
  ];
  const fakeSpeechScope = {
    SpeechSynthesisUtterance: function FakeUtterance(text) { this.text = text; },
    speechSynthesis: {
      getVoices: () => fakeVoices,
      cancel: () => { fakeSpeechScope.cancelled = (fakeSpeechScope.cancelled || 0) + 1; },
      speak: (u) => { fakeSpeechScope.spoken = u; },
    },
  };
  assert(isSpeechSupported(fakeSpeechScope) === true, 'mock 语音环境检测为支持');
  const sortedVoices = listBrowserVoices(fakeSpeechScope);
  assert(sortedVoices[0].lang === 'zh-CN' && pickChineseVoice(sortedVoices).name === '中文女声',
    '浏览器语音中文优先排序');
  const spoken = await speakText('关羽，参战！', {
    voice: sortedVoices[0], rate: 1.2, pitch: 1.1, scope: fakeSpeechScope,
  });
  assert(spoken.ok && fakeSpeechScope.spoken && fakeSpeechScope.spoken.text === '关羽，参战！'
    && fakeSpeechScope.spoken.rate === 1.2 && fakeSpeechScope.spoken.lang === 'zh-CN',
  'speakText 调用 speechSynthesis 并设置语速/语言');
  assert((await speakText('', { scope: fakeSpeechScope })).ok === false, '空文本朗读被拒绝');
  assert((await speakText('测试', { scope: fakeScopeNoSpeech })).ok === false, '不支持环境朗读返回中文错误');
  assert(stopSpeech(fakeSpeechScope) === true && fakeSpeechScope.cancelled >= 1, 'stopSpeech 取消浏览器朗读');

  let gptFetchCall = null;
  const gptOk = await generateGptSpeech(
    { text: '关羽，参战！', refAudioPath: DEFAULT_VOICE_REF, promptText: '参考文本' },
    {
      fetchImpl: async (url, options) => {
        gptFetchCall = { url, options };
        return { ok: true, status: 200, blob: async () => ({ size: 32, type: 'audio/wav' }) };
      },
      createObjectUrl: () => 'blob:mock-voice',
    },
  );
  assert(gptOk.ok && gptOk.audioUrl === 'blob:mock-voice', 'generateGptSpeech 成功返回 objectURL');
  assert(gptFetchCall && gptFetchCall.url === '/voice-api/tts'
    && JSON.parse(gptFetchCall.options.body).text === '关羽，参战！',
  'generateGptSpeech 经 /voice-api 代理提交');
  const gpt503 = await generateGptSpeech(
    { text: '测试', refAudioPath: DEFAULT_VOICE_REF, promptText: '参考文本' },
    { fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'unavailable' }) },
  );
  assert(gpt503.ok === false && gpt503.error.includes('start-voice.bat'),
    'generateGptSpeech 503 引导启动本地服务');
  const gptNetwork = await generateGptSpeech(
    { text: '测试', refAudioPath: DEFAULT_VOICE_REF, promptText: '参考文本' },
    { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } },
  );
  assert(gptNetwork.ok === false && gptNetwork.error.includes('start-voice.bat'),
    'generateGptSpeech 网络失败中文提示');

  const appCssVoice = readFileSync('src/App.css', 'utf8');
  for (const key of ['wsGoldShimmer', 'wsInkReveal', 'wsTitleBreath', 'wsCardGlint', 'wsIconFloat']) {
    assert(appCssVoice.includes('@keyframes ' + key), `App.css 含字体动效 keyframes ${key}`);
  }
  assert(appCssVoice.includes('.voice-studio') && appCssVoice.includes('.voice-security')
    && appCssVoice.includes('.btn-ai'), 'App.css 含配音/入口样式');
  assert(appCssVoice.includes('prefers-reduced-motion') && appCssVoice.includes('animation: none !important'),
    '字体/配音动效有 reduced-motion 降级');

  const viteSrc = readFileSync('vite.config.js', 'utf8');
  assert(viteSrc.includes('/voice-api') && viteSrc.includes('127.0.0.1:9880')
    && viteSrc.includes('changeOrigin') && viteSrc.includes('rewrite'),
  'Vite 代理 /voice-api → 127.0.0.1:9880');
  const batSrc = readFileSync('start-voice.bat', 'utf8');
  assert(batSrc.includes('api_v2.py') && batSrc.includes('9880')
    && batSrc.includes('GPT-SoVITS-v2pro-20250604-nvidia50')
    && batSrc.includes('runtime') && batSrc.includes('pause'),
  'start-voice.bat 启动 GPT-SoVITS API 并保留窗口');

  console.log('\n[36] Piper 离线配音：请求 / 失败 / SSR');
  assert(DEFAULT_PIPER_API_BASE === '/piper-api' && PIPER_TEXT_LIMIT === 300,
    'Piper 默认 API 与文本上限');
  const piperReq = buildPiperRequest({ text: '  关羽，参战！ ' });
  assert(piperReq.ok && piperReq.url === '/piper-api/tts' && piperReq.method === 'POST'
    && piperReq.headers['Content-Type'] === 'application/json'
    && piperReq.body.text === '关羽，参战！' && piperReq.timeoutMs === 60000,
  'buildPiperRequest 默认请求（POST /piper-api/tts + 60s 超时）');
  assert(buildPiperRequest({ text: '测试', apiBase: '/piper-api/' }).url === '/piper-api/tts',
    'Piper API 前缀去尾斜杠');
  assert(buildPiperRequest({ text: '' }).ok === false
    && buildPiperRequest({ text: '' }).error.includes('试听文本'),
  'Piper 空文本校验');
  assert(buildPiperRequest({ text: '甲'.repeat(PIPER_TEXT_LIMIT + 1) }).ok === false
    && buildPiperRequest({ text: '甲'.repeat(PIPER_TEXT_LIMIT + 1) }).error.includes('过长'),
  'Piper 文本过长中文提示');
  assert(buildPiperRequest({ text: '甲'.repeat(PIPER_TEXT_LIMIT) }).ok === true,
    'Piper 文本上限内可用');

  const piperStorage = (() => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  })();
  assert(saveVoiceConfig({ provider: 'piper', piperApiBase: '/piper-api', speed: 1.1 }, piperStorage) === true,
    '保存 Piper provider 配置');
  const loadedPiperConfig = readVoiceConfig(piperStorage);
  assert(loadedPiperConfig.provider === 'piper' && loadedPiperConfig.piperApiBase === '/piper-api'
    && loadedPiperConfig.speed === 1.1, '读取 Piper provider 配置');
  assert(normalizeVoiceConfig({ provider: 'piper', piperApiBase: '' }).piperApiBase === DEFAULT_PIPER_API_BASE,
    'Piper API 空值回退默认');
  assert(normalizeVoiceConfig({ provider: 'unknown' }).provider === 'browser',
    '未知 provider 回退浏览器');

  assert(mapPiperError(503).includes('start-piper.bat'), 'Piper 503 引导 start-piper.bat');
  assert(mapPiperError(500).includes('start-piper.bat'), 'Piper 500 引导查看服务窗口');
  assert(mapPiperError(400).includes('缩短'), 'Piper 400 提示缩短短语');
  assert(mapPiperError(404).includes('接口'), 'Piper 404 提示 API 地址');
  assert(piperErrorFromException(new TypeError('Failed to fetch')).includes('start-piper.bat'),
    'Piper 网络异常引导 start-piper.bat');
  assert(piperErrorFromException({ name: 'AbortError' }).includes('超时'), 'Piper 超时中文提示');

  const healthOk = await checkPiperHealth({}, {
    fetchImpl: async (url) => ({ ok: true, status: 200, url }),
  });
  assert(healthOk.ok && healthOk.status === 200, 'Piper /health 检测成功');
  const healthFail = await checkPiperHealth({}, {
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'down' }),
  });
  assert(healthFail.ok === false && healthFail.error.includes('start-piper.bat'),
    'Piper /health 失败引导 start-piper.bat');

  let piperCall = null;
  const piperOk = await generatePiperSpeech(
    { text: '关羽，参战！' },
    {
      fetchImpl: async (url, options) => {
        piperCall = { url, options };
        return { ok: true, status: 200, blob: async () => ({ size: 44, type: 'audio/wav' }) };
      },
      createObjectUrl: () => 'blob:piper-voice',
    },
  );
  assert(piperOk.ok && piperOk.audioUrl === 'blob:piper-voice' && piperOk.provider === 'piper',
    'generatePiperSpeech 成功返回 objectURL');
  assert(piperCall && piperCall.url === '/piper-api/tts'
    && JSON.parse(piperCall.options.body).text === '关羽，参战！',
  'generatePiperSpeech 提交到 /piper-api 代理');
  const piper503 = await generatePiperSpeech(
    { text: '测试' },
    { fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'unavailable' }) },
  );
  assert(piper503.ok === false && piper503.error.includes('start-piper.bat'),
    'generatePiperSpeech 503 引导启动 Piper');
  const piperEmpty = await generatePiperSpeech(
    { text: '测试' },
    { fetchImpl: async () => ({ ok: true, status: 200, blob: async () => ({ size: 0 }) }) },
  );
  assert(piperEmpty.ok === false && piperEmpty.error.includes('空音频'),
    'generatePiperSpeech 空音频提示');
  let piperNetworkFetched = false;
  const piperNetwork = await generatePiperSpeech(
    { text: '测试' },
    { fetchImpl: async () => { piperNetworkFetched = true; throw new TypeError('Failed to fetch'); } },
  );
  assert(piperNetwork.ok === false && piperNetwork.error.includes('start-piper.bat'),
    'generatePiperSpeech 网络失败中文提示');
  const piperTooLong = await generatePiperSpeech(
    { text: '甲'.repeat(PIPER_TEXT_LIMIT + 1) },
    { fetchImpl: async () => { piperNetworkFetched = true; return { ok: true, blob: async () => ({ size: 1 }) }; } },
  );
  assert(piperTooLong.ok === false && piperTooLong.error.includes('过长'),
    'generatePiperSpeech 过长文本不请求服务');

  const piperVoiceHtml = renderToString(React.createElement(VoiceStudio, {
    name: '关羽', skillNames: ['武圣'],
  }));
  for (const text of ['Piper 离线', 'start-piper.bat', '无需参考音频', '离线免费', 'Piper · 离线免费']) {
    assert(piperVoiceHtml.includes(text), `AI 配音面板含「${text}」`);
  }
  const appCssPiper = readFileSync('src/App.css', 'utf8');
  assert(appCssPiper.includes('.voice-piper-note') && appCssPiper.includes('.voice-service-badge')
    && appCssPiper.includes('.voice-provider-legend'), 'App.css 含 Piper 说明/状态/引擎徽标样式');
  const vitePiperSrc = readFileSync('vite.config.js', 'utf8');
  assert(vitePiperSrc.includes('/piper-api') && vitePiperSrc.includes('127.0.0.1:9881')
    && vitePiperSrc.includes('/voice-api'), 'Vite 代理 /piper-api → 9881 与 /voice-api 并存');

  console.log('\n[37] 图标系统 v2：哑光金层次 / 重绘 / HP SVG / 源码审计');
  const matteIconNames = ['sword', 'shield', 'heart', 'book', 'editor', 'mic', 'palette', 'settings', 'trophy'];
  for (const iconName of matteIconNames) {
    const html = renderToString(React.createElement(Icon, { name: iconName, size: 20 }));
    const fillMatch = html.match(/fill-opacity="(0\.\d+)"/);
    const fillValue = fillMatch ? Number(fillMatch[1]) : null;
    assert(html.includes('fill="currentColor"') && fillValue !== null
      && fillValue >= 0.10 && fillValue <= 0.16,
    `哑光金层次：${iconName} 关键面 fill-opacity 0.10~0.16`, fillValue);
  }
  assert(renderToString(React.createElement(Icon, { name: 'not-a-real-icon' })) === '',
    '未知 Icon name 返回 null/空 SSR');
  assert(ICON_NAMES.length >= 45, 'ICON_NAMES 数量 ≥45', ICON_NAMES.length);

  const iconSrcV2 = readFileSync('src/components/ui/Icon.jsx', 'utf8');
  const definedIconNames = new Set(
    [...iconSrcV2.matchAll(/case '([a-z0-9-]+)':/g)].map(m => m[1]),
  );
  const missingCases = ICON_NAMES.filter(name => !definedIconNames.has(name));
  assert(missingCases.length === 0, 'ICON_NAMES 中每个图标都有 switch 分支', missingCases.join(','));
  const componentDir = join(process.cwd(), 'src', 'components');
  const componentFiles = readdirSync(componentDir, { recursive: true })
    .filter(rel => /\.(jsx|js)$/.test(String(rel)));
  const usedIconNames = new Set();
  for (const rel of componentFiles) {
    const fileText = readFileSync(join('src/components', String(rel)), 'utf8');
    for (const match of fileText.matchAll(/<Icon\s+[^>]*?name="([a-zA-Z0-9-]+)"/g)) {
      usedIconNames.add(match[1]);
    }
  }
  const unknownIconNames = [...usedIconNames].filter(name => !ICON_NAMES.includes(name));
  assert(unknownIconNames.length === 0,
    '源码审计：所有 <Icon name> 均在 ICON_NAMES 中', unknownIconNames.join(','));
  assert(usedIconNames.size >= 10, '源码审计：扫描到足量图标使用', usedIconNames.size);

  const playerAreaV2Src = readFileSync('src/components/GameBoard/PlayerArea.jsx', 'utf8');
  const selfCardV2Src = readFileSync('src/components/GameBoard/SelfCharacterCard.jsx', 'utf8');
  assert(!playerAreaV2Src.includes('♥') && playerAreaV2Src.includes('name="heart"')
    && !selfCardV2Src.includes('♥') && selfCardV2Src.includes('name="heart"'),
  'HP 字符 ♥ 已替换为 Icon heart');
  const selfHpHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: self, hit: false, damage: null, onPointerDown: noop, onDoubleClick: noop,
  }));
  assert(selfHpHtml.includes('data-icon="heart"') && !selfHpHtml.includes('♥')
    && selfHpHtml.includes('hp-dot filled'),
  '武将卡血量渲染为 SVG heart（保留 filled/empty 样式）');

  const mainMenuV2Src = readFileSync('src/components/Menu/MainMenu.jsx', 'utf8');
  assert(mainMenuV2Src.includes('name="sword" size={32}')
    && mainMenuV2Src.includes('size={19}')
    && mainMenuV2Src.includes('mm-tile-icon'),
  '主菜单大牌/功能卡图标尺寸统一');
  assert(mainMenuV2Src.includes("icon: 'palette'") && mainMenuV2Src.includes('name="sparkle"')
    && mainMenuV2Src.includes("navigate('editor', { focus: 'art' })"),
  '主菜单 AI 立绘使用 palette/sparkle 新图标');
  assert(mainMenuV2Src.includes('mm-stage') && mainMenuV2Src.includes('mm-deck')
    && mainMenuV2Src.includes('mm-tile') && mainMenuV2Src.includes('mm-band-head')
    && mainMenuV2Src.includes("e.key !== 'Enter'"),
  '主菜单全屏分组仪表盘 + Enter 快速开局');
  const gameBoardHubSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(gameBoardHubSrc.includes('table-hub') && gameBoardHubSrc.includes('hub-rose')
    && gameBoardHubSrc.includes('phase-track') && gameBoardHubSrc.includes('PHASE_SEQUENCE')
    && gameBoardHubSrc.includes('phase-node'),
  '局内中央罗盘 + 六阶段轨道');
  const workshopV2Src = readFileSync('src/components/Editor/CharacterEditor.jsx', 'utf8');
  for (const iconName of ['palette', 'mic', 'plus', 'upload', 'download', 'check']) {
    assert(workshopV2Src.includes(`name="${iconName}"`), `工坊顶栏使用 ${iconName} 图标`);
  }

  const appCssV2 = readFileSync('src/App.css', 'utf8');
  assert(appCssV2.includes('.btn:hover .ui-icon') && appCssV2.includes('translateY(-1px)')
    && appCssV2.includes('.btn:disabled .ui-icon') && appCssV2.includes('iconMicBreath')
    && appCssV2.includes('.hp-dot .ui-icon') && appCssV2.includes('.hp-dot.filled .ui-icon'),
  'App.css 含图标 hover/disabled/mic 呼吸/HP 心形样式');
  assert(appCssV2.includes('@keyframes iconMicBreath')
    && appCssV2.includes('.ui-icon--mic { animation: none !important; }'),
  '图标动效含 reduced-motion 降级');
  assert(/\.btn \.ui-icon,\s*\.icon-btn \.ui-icon/.test(appCssV2),
    '按钮图标统一基线/尺寸样式');

  console.log('\n[38] AI 兜底：Kudos 403 / 免费方案 / 跨玩家浏览器语音');
  const kudosBody = JSON.stringify({ message: 'Due to heavy demand, this request requires 25 kudos (KudosUpfront)', rc: 'KudosUpfront' });
  const kudosRes = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    {
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => kudosBody }),
      sleep: async () => {},
    },
  );
  assert(kudosRes.ok === false && kudosRes.code === 'kudos'
    && kudosRes.error.includes('KudosUpfront') && kudosRes.error.includes('hordeKey')
    && kudosRes.error.includes('免费'), 'Stable Horde 403 KudosUpfront 中文可操作提示');
  const forbiddenRes = await generateArt(
    { provider: 'stable-horde', prompt: '关羽' },
    { fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'Forbidden' }), sleep: async () => {} },
  );
  assert(forbiddenRes.ok === false && forbiddenRes.code === 'forbidden'
    && forbiddenRes.error.includes('hordeKey'), 'Stable Horde 普通 403 也提示 hordeKey/切换');
  assert(analyzeStableHordeError(403, 'requires 5 kudos').code === 'kudos'
    && analyzeStableHordeError(401, '').code === 'auth'
    && analyzeStableHordeError(500, 'boom') === null, 'analyzeStableHordeError 分类');

  assert(ART_FREE_GUIDE.length >= 5
    && ['huggingface', 'zhipu', 'siliconflow', 'pollinations', 'stable-horde', 'local-sd']
      .every(id => ART_FREE_GUIDE.some(item => item.id === id)),
  '免费方案引导覆盖 HF/智谱/硅基流动/Pollinations/本地 SD');
  assert(ART_FREE_GUIDE.some(item => item.provider === 'custom' && item.preset === 'zhipu'),
    '免费方案包含智谱快捷预设');
  const stableInspect = inspectArtProvider('stable-horde', {});
  assert(stableInspect.ok && stableInspect.status === 'queue'
    && stableInspect.message.includes('512×768') && stableInspect.message.includes('8 步'),
  'Provider 自检：Stable Horde 匿名 512×768/8 步');
  const hordeKeyInspect = inspectArtProvider('stable-horde', { hordeKey: 'k' });
  assert(hordeKeyInspect.status === 'configured' && hordeKeyInspect.label.includes('hordeKey'),
    'Provider 自检：hordeKey 已配置');
  assert(inspectArtProvider('huggingface', {}).ok === false
    && inspectArtProvider('huggingface', { huggingfaceToken: 'hf_x' }).ok === true,
  'Provider 自检：HF Token 完整性');
  assert(inspectArtProvider('local-sd', {}).ok === true
    && inspectArtProvider('local-sd', {}).message.includes('本机'),
  'Provider 自检：本地 SD 需本机服务');
  assert(inspectArtProvider('custom', {}).ok === false
    && inspectArtProvider('custom', { customBaseUrl: 'https://x', customApiKey: 'k', customModel: 'm' }).ok === true,
  'Provider 自检：自定义配置完整性');

  let selfCheckFetch = null;
  const stableCheck = await checkArtProviderConnection('stable-horde', {}, {
    fetchImpl: async (url) => { selfCheckFetch = url; return { ok: true, status: 200, json: async () => [{}, {}] }; },
  });
  assert(stableCheck.ok && stableCheck.status === 'online'
    && selfCheckFetch === 'https://stablehorde.net/api/v2/status/models'
    && stableCheck.message.includes('2'), '自检：Stable Horde /status/models 在线');
  const sdOffline = await checkArtProviderConnection('local-sd', {}, {
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  assert(sdOffline.ok === false && sdOffline.error.includes('--api'), '自检：本地 SD 不可用引导 --api');
  const hfCheck = await checkArtProviderConnection('huggingface', {}, {
    fetchImpl: async () => { throw new Error('should not fetch'); },
  });
  assert(hfCheck.ok === false && hfCheck.status === 'needs-key', '自检：HF 缺 Token 不发起网络');

  const artStudioFallbackHtml = renderToString(React.createElement(ArtStudio, {
    name: '关羽', group: 'shu', description: '武圣',
  }));
  for (const text of ['免费方案引导', '检查配置 / 连接', '切换', 'Stable Horde',
    'Hugging Face FLUX.1-schnell', '智谱 CogView-3-Flash']) {
    assert(artStudioFallbackHtml.includes(text), `AI 立绘画廊含「${text}」`);
  }
  const artStudioSrc = readFileSync('src/components/Editor/ArtStudio.jsx', 'utf8');
  assert(artStudioSrc.includes('art-error-box') && artStudioSrc.includes('art-error-actions')
    && artStudioSrc.includes('checkArtProviderConnection') && artStudioSrc.includes('ART_FREE_GUIDE'),
  'ArtStudio 含失败重试/切换/清错误与自检/免费引导');
  assert(!/D:\\\\AI-shengyin/.test(artStudioSrc) && !/D:\\\\AI-shengyin/.test(readFileSync('src/ai/artProviders.js', 'utf8'))
    && !artStudioSrc.includes('voice_refs'), 'AI 立绘引导不依赖 D:\\ 本机路径');

  const emptyVoiceScope = {
    SpeechSynthesisUtterance: function EmptyU(text) { this.text = text; },
    speechSynthesis: {
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      speak: (u) => { emptyVoiceScope.spoken = u; },
    },
  };
  const emptyVoices = await waitForBrowserVoices(20, emptyVoiceScope);
  assert(Array.isArray(emptyVoices) && emptyVoices.length === 0, 'waitForBrowserVoices 无 voices 超时返回 []');
  const spokenEmpty = await speakText('关羽，参战！', { scope: emptyVoiceScope });
  assert(spokenEmpty.ok && emptyVoiceScope.spoken && emptyVoiceScope.spoken.text === '关羽，参战！'
    && emptyVoiceScope.spoken.lang === 'zh-CN',
  'speakText 空 voices 仍尝试默认 utterance（zh-CN）');
  const asyncVoiceScope = {
    SpeechSynthesisUtterance: function AsyncU(text) { this.text = text; },
    speechSynthesis: {
      getVoices: () => asyncVoiceScope.voices,
      addEventListener: (name, handler) => { asyncVoiceScope.handler = handler; },
      removeEventListener: () => {},
      cancel: () => {},
      speak: () => {},
    },
    voices: [],
  };
  const waitingVoices = waitForBrowserVoices(1000, asyncVoiceScope);
  asyncVoiceScope.voices = [{ name: '中文女声', lang: 'zh-CN', voiceURI: 'zh' }];
  asyncVoiceScope.handler();
  const resolvedVoices = await waitingVoices;
  assert(resolvedVoices.length === 1 && resolvedVoices[0].lang === 'zh-CN',
    'waitForBrowserVoices voiceschanged 后返回中文语音');
  assert(speechErrorMessage({ error: 'synthesis-failed' }).includes('安装中文语音')
    && speechErrorMessage({ error: 'not-allowed' }).includes('阻止'), 'speechErrorMessage 中文可操作提示');

  const voiceFallbackHtml = renderToString(React.createElement(VoiceStudio, {
    name: '关羽', skillNames: ['武圣'],
  }));
  for (const text of ['浏览器语音所有玩家可用', '改用本地 Piper',
    '系统未安装中文语音', '系统语音 0 个', 'start-piper.bat', 'start-voice.bat', 'Piper 离线']) {
    assert(voiceFallbackHtml.includes(text), `AI 配音兜底含「${text}」`);
  }
  assert(readVoiceConfig().provider === 'browser', '新用户默认「浏览器语音」');
  const voiceStudioSrc = readFileSync('src/components/Editor/VoiceStudio.jsx', 'utf8');
  assert(voiceStudioSrc.includes('waitForBrowserVoices') && voiceStudioSrc.includes('voice-service-warning')
    && voiceStudioSrc.includes('voice-warning') && voiceStudioSrc.includes('voice-fallback-actions')
    && voiceStudioSrc.includes('改用浏览器语音'), 'VoiceStudio 含等待 voices/本地警告/兜底切换');
  const appCssFallback = readFileSync('src/App.css', 'utf8');
  assert(appCssFallback.includes('.art-free-guide') && appCssFallback.includes('.art-error-actions')
    && appCssFallback.includes('.voice-cross-player') && appCssFallback.includes('.voice-service-warning')
    && appCssFallback.includes('.voice-warning-actions'), 'App.css 含免费引导/自检/配音兜底样式');

  console.log('\n[39] Stable Horde 匿名额度：512×768/8 步 clamp / 403 降级重试');
  assert(HORDE_ANON_LIMITS.width === 512 && HORDE_ANON_LIMITS.height === 768
    && HORDE_ANON_LIMITS.steps === 8, '匿名安全额度常量为 512×768/8');
  const defaultHorde = buildArtRequest({ provider: 'stable-horde', prompt: '关羽' });
  assert(defaultHorde.body.params.width === 512 && defaultHorde.body.params.height === 768
    && defaultHorde.body.params.steps === 8 && defaultHorde.budgetLimited === false
    && defaultHorde.anonymous === true, 'Stable Horde 默认 512×768 / 8 步');
  const clampedByHelper = applyAnonymousHordeLimits({ width: 1024, height: 1024, steps: 24 });
  assert(clampedByHelper.width === 512 && clampedByHelper.height === 768
    && clampedByHelper.steps === 8 && clampedByHelper.limited === true
    && clampedByHelper.note.includes('hordeKey'), 'applyAnonymousHordeLimits 限额与提示');
  const anonLargeReq = buildArtRequest({ provider: 'stable-horde', prompt: '关羽', width: 1024, height: 1024 });
  const keyedLargeReq = buildArtRequest({
    provider: 'stable-horde', prompt: '关羽', width: 1024, height: 1024, config: { hordeKey: 'k' },
  });
  assert(canClampHordeRequest(anonLargeReq) === false && canClampHordeRequest(keyedLargeReq) === true,
    'canClampHordeRequest 仅大尺寸/有 key 可降级');
  const clampedReq = clampHordeRequestToAnonymous(keyedLargeReq);
  assert(clampedReq.body.params.width === 512 && clampedReq.body.params.height === 768
    && clampedReq.body.params.steps === 8 && clampedReq.budgetLimited === true
    && clampedReq.sizeNote.includes('降级'), 'clampHordeRequestToAnonymous 复制并降级');
  const bigAnonymous = buildArtRequest({
    provider: 'stable-horde', prompt: '关羽', width: 1024, height: 1024, config: { hordeKey: 'k' },
  });
  assert(bigAnonymous.body.params.width === 1024 && bigAnonymous.body.params.height === 1024,
    '有 hordeKey 保留 1024×1024');
  assert(ART_SIZES[0].id === 's512' && ART_SIZES[0].needsKey !== true
    && ART_SIZES[1].needsKey === true && ART_SIZES[2].needsKey === true,
  '尺寸下拉 512 免费，768/1024 标注需 hordeKey');
  const hordeInspectV2 = inspectArtProvider('stable-horde', {});
  assert(hordeInspectV2.message.includes('512×768') && hordeInspectV2.message.includes('8 步')
    && hordeInspectV2.message.includes('hordeKey'), 'Provider 自检说明匿名 512×768/8 步与 hordeKey');

  let retryCalls = 0;
  const retryBodies = [];
  const retryResult = await generateArt(
    { provider: 'stable-horde', prompt: '关羽', config: { hordeKey: 'k' }, width: 768, height: 1024 },
    {
      sleep: async () => {},
      fetchImpl: async (url, options) => {
        retryCalls += 1;
        if (url.includes('/generate/async')) {
          retryBodies.push(JSON.parse(options.body));
          if (retryBodies.length === 1) {
            return { ok: false, status: 403, text: async () => JSON.stringify({ message: 'requires 25 kudos (KudosUpfront)' }) };
          }
          return { ok: true, status: 202, json: async () => ({ id: 'job-clamped' }) };
        }
        if (url.includes('/check/')) return { ok: true, status: 200, json: async () => ({ done: true }) };
        return { ok: true, status: 200, json: async () => ({ generations: [{ img: 'https://cdn.example.com/ok.webp' }] }) };
      },
    },
  );
  assert(retryResult.ok && retryResult.imageUrl === 'https://cdn.example.com/ok.webp'
    && retryResult.budgetLimited === true, '403 KudosUpfront 自动降级重试一次后成功');
  assert(retryBodies.length === 2
    && retryBodies[0].params.width === 768 && retryBodies[0].params.height === 1024
    && retryBodies[1].params.width === 512 && retryBodies[1].params.height === 768
    && retryBodies[1].params.steps === 8 && retryCalls === 4,
  '403 重试提交 512×768/8 步（仅重试一次）');

  let anon403Calls = 0;
  const anon403 = await generateArt(
    { provider: 'stable-horde', prompt: '关羽', width: 768, height: 1024 },
    {
      sleep: async () => {},
      fetchImpl: async () => {
        anon403Calls += 1;
        return { ok: false, status: 403, text: async () => '{"rc":"KudosUpfront","message":"requires kudos"}' };
      },
    },
  );
  assert(anon403.ok === false && anon403.code === 'kudos' && anon403.budgetLimited === true
    && anon403.error.includes('已自动尝试') && anon403Calls === 1,
  '匿名已 clamp 仍 403：不重复请求并提示已尝试 512×768/8');

  const artStudioQuotaHtml = renderToString(React.createElement(ArtStudio, {
    name: '关羽', group: 'shu', description: '武圣',
  }));
  for (const text of ['512×768 / 8 步', '需 hordeKey', '512×768（匿名免费）', '768×1024（需 hordeKey）']) {
    assert(artStudioQuotaHtml.includes(text), `AI 立绘额度提示含「${text}」`);
  }
  const artStudioQuotaSrc = readFileSync('src/components/Editor/ArtStudio.jsx', 'utf8');
  assert(artStudioQuotaSrc.includes("useState('s512')") && artStudioQuotaSrc.includes('size.needsKey'),
    'ArtStudio 默认尺寸 512×768 且大尺寸提示 hordeKey');
  const appCssQuota = readFileSync('src/App.css', 'utf8');
  assert(appCssQuota.includes('.art-hint.warn'), 'App.css 含尺寸需 hordeKey 提示样式');

  console.log('\n[40] 演出升级：出牌桌面展示 / 弃牌 / 斩杀分半 / 按钮与剑徽');
  const tableFx = mapTableCardEffect({
    id: 'card-1', type: 'card',
    player: { name: '关羽' }, target: { name: '曹操' },
    card: { name: '杀', suit: 'spade', numberDisplay: '7' },
  });
  assert(tableFx && tableFx.card.name === '杀' && tableFx.playerName === '关羽'
    && tableFx.targetName === '曹操', '出牌事件 → 桌面卡片数据（玩家/目标）');
  assert(mapTableCardEffect({ type: 'card', player: { name: '关羽' } }) === null
    && mapTableCardEffect({ type: 'card', card: { name: '杀' } }) !== null,
  '无 card 数据不展示空卡，仅有牌名也可展示');
  assert(mapTableCardEffect({ type: 'weapon', name: '寒冰剑' }) === null
    && mapTableCardEffect(null) === null, '技能/武器/空事件不出桌面牌');
  const tableStageHtml = renderToString(React.createElement(TableCardStage, { fx: tableFx }));
  for (const text of ['table-card-stage', 'table-card-face', '杀', '关羽 使用', '目标 曹操', '♠', '7']) {
    assert(tableStageHtml.includes(text), `TableCardStage 含「${text}」`);
  }
  assert(renderToString(React.createElement(TableCardStage, { fx: null })) === '',
    'TableCardStage 无 fx 时 SSR 为空');

  const discardFx = mapDiscardEffect({
    id: 'discard-1', type: 'discard', player: { name: '关羽' },
    cards: [{ name: '桃', suit: 'heart' }, { name: '闪' }, { name: '杀' }, { name: '酒' }],
    reason: '过河拆桥',
  });
  assert(discardFx && discardFx.cards.length === 3 && discardFx.count === 3
    && discardFx.playerName === '关羽' && discardFx.reason === '过河拆桥',
  '弃牌事件 → 最多 3 张牌 + reason');
  assert(mapDiscardEffect({ type: 'discard', cards: [] }) === null
    && mapDiscardEffect({ type: 'discard' }) === null
    && mapDiscardEffect({ type: 'draw' }) === null
    && mapDiscardEffect(null) === null, '空/未知弃牌事件防御性忽略');
  let dq = [];
  dq = enqueueDiscard(dq, discardFx);
  dq = enqueueDiscard(dq, { ...discardFx, id: 'discard-2' });
  dq = enqueueDiscard(dq, { ...discardFx, id: 'discard-3' });
  dq = enqueueDiscard(dq, { ...discardFx, id: 'discard-4' });
  assert(dq.length === 3 && dq[2].id === 'discard-4' && dq[0].id === 'discard-2',
    '弃牌队列连续事件排队、最多 3 个不丢最新');
  assert(shiftDiscard(dq).length === 2 && shiftDiscard([]).length === 0, '弃牌队列出队');
  const discardHtml = renderToString(React.createElement(DiscardBurst, { fx: discardFx, onShift: noop }));
  for (const text of ['discard-burst', '弃牌', '关羽', '过河拆桥', '桃', '闪', '杀', 'discard-card']) {
    assert(discardHtml.includes(text), `DiscardBurst 含「${text}」`);
  }
  assert(renderToString(React.createElement(DiscardBurst, { fx: null })) === '',
    'DiscardBurst 无 fx 时 SSR 为空');

  const deathFx = mapEffectToFx({
    type: 'death', player: {
      name: '关羽', hp: 2, character: { name: '关羽', imageUrl: 'https://example.com/guanyu.jpg', group: 'shu' },
    }, source: { name: '张飞' }, reason: 'execution',
  });
  assert(deathFx.kind === 'execution' && deathFx.victimImage === 'https://example.com/guanyu.jpg'
    && deathFx.victimHp === 2 && deathFx.victimGroup === 'shu' && deathFx.text === '斩',
  'mapEffectToFx death 携带 victimImage/hp/group');
  const execHtml = renderToString(React.createElement(ExecutionOverlay, { fx: deathFx }));
  assert((execHtml.match(/fx-victim-half/g) || []).length === 2
    && execHtml.includes('fx-exec-slash') && execHtml.includes('fx-victim-image')
    && execHtml.includes('https://example.com/guanyu.jpg') && execHtml.includes('fx-exec-ink'),
  'Execution 渲染上下两半 + 斜刀光 + victim 立绘');
  const execFallbackHtml = renderToString(React.createElement(ExecutionOverlay, {
    fx: { kind: 'execution', victim: '关羽', text: '阵亡' },
  }));
  assert(execFallbackHtml.includes('fx-victim-card no-image')
    && execFallbackHtml.includes('fx-victim-initial') && !execFallbackHtml.includes('fx-victim-image')
    && execFallbackHtml.includes('阵亡'), 'Execution 无图用名字首字兜底');
  const execNoSource = mapEffectToFx({ type: 'death', player: { name: '关羽' } });
  assert(execNoSource.text === '阵亡', '无来源显示阵亡而非斩');
  const appCssFx3 = readFileSync('src/App.css', 'utf8');
  for (const key of ['tableCardStageIn', 'tableCardAura', 'discardFly', 'discardInk',
    'fxVictimTop', 'fxVictimBottom', 'fxExecSlash']) {
    assert(appCssFx3.includes('@keyframes ' + key), `App.css 含演出 keyframes ${key}`);
  }
  const tableKeyframeBlock = (appCssFx3.match(/@keyframes tableCardStageIn \{([\s\S]*?)\n\}/) || [])[1] || '';
  assert(tableKeyframeBlock.includes('transform') && tableKeyframeBlock.includes('opacity')
    && !/^\s*(top|left|width|height):/m.test(tableKeyframeBlock),
  '桌面出牌 keyframes 只动 transform/opacity');
  assert(appCssFx3.includes('.btn:hover:not(:disabled)')
    && appCssFx3.includes('translateY(-2px) scale(1.02)')
    && appCssFx3.includes('transition: transform 190ms var(--ease-ios)')
    && appCssFx3.includes('.btn:disabled:hover'), '按钮 hover 抬升/缩放/disabled 不变');
  assert(appCssFx3.includes('.table-card-stage') && appCssFx3.includes('.discard-burst')
    && appCssFx3.includes('.fx-execution-victim') && appCssFx3.includes('.fx-victim-half'),
  'App.css 含桌面牌/弃牌/分半样式');
  const victimReducedIndex = appCssFx3.lastIndexOf('.fx-victim-bottom { display: none; }');
  const beforeVictimReduced = victimReducedIndex >= 0
    ? appCssFx3.slice(Math.max(0, victimReducedIndex - 900), victimReducedIndex)
    : '';
  assert(victimReducedIndex > 0 && beforeVictimReduced.includes('@media (prefers-reduced-motion: reduce)')
    && beforeVictimReduced.includes('animation: none !important')
    && beforeVictimReduced.includes('.table-card-stage'), '演出含 reduced-motion 降级');
  const mainMenuFxSrc = readFileSync('src/components/Menu/MainMenu.jsx', 'utf8');
  for (const key of ['crestFloat', 'crestShineSweep', 'bladeSwayA', 'bladeSwayB', 'crestSpin']) {
    assert(mainMenuFxSrc.includes('@keyframes ' + key), `剑徽含 keyframes ${key}`);
  }
  assert(mainMenuFxSrc.includes('crest-shine') && mainMenuFxSrc.includes('crestShineSweep')
    && mainMenuFxSrc.includes('crestBreath') && mainMenuFxSrc.includes('prefers-reduced-motion'),
  '剑徽含高光扫过/呼吸/降级');
  const gameBoardTableSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(gameBoardTableSrc.includes('TableCardStage') && gameBoardTableSrc.includes('DiscardBurst')
    && gameBoardTableSrc.includes('mapDiscardEffect') && gameBoardTableSrc.includes('enqueueDiscard'),
  'GameBoard 接入桌面牌与弃牌队列（防御性）');

  console.log('\n[41] 卡牌呼吸：CardFace 图层 / 错峰 / 降级');
  const breathCard = { name: '杀', suit: 'spade', numberDisplay: '7', type: 'basic' };
  const breathFaceHtml = renderToString(React.createElement(CardFace, { card: breathCard }));
  assert(breathFaceHtml.includes('class="card-breath"')
    && breathFaceHtml.includes('aria-hidden="true"'), 'CardFace 含 card-breath 图层与 aria-hidden');
  const breathFaceSrc = readFileSync('src/components/GameBoard/CardFace.jsx', 'utf8');
  assert(breathFaceSrc.includes('card-breath') && !breathFaceSrc.includes('::before')
    && !breathFaceSrc.includes('::after'), 'CardFace 呼吸层不占用伪元素');
  const handBreathHtml = renderToString(React.createElement(HandZone, {
    cards: [breathCard, { name: '闪', suit: 'heart', numberDisplay: '2', type: 'basic' }],
    selectedCards: [breathCard],
    canSelect: () => true,
    onToggleCard: noop,
  }));
  assert(handBreathHtml.includes('card-breath') && handBreathHtml.includes('--breath-delay'),
    '手牌 CardFace 呼吸且带错峰变量');
  const tableBreathHtml = renderToString(React.createElement(TableCardStage, {
    fx: { id: 'b1', card: breathCard, playerName: '关羽', targetName: '曹操' },
  }));
  assert(tableBreathHtml.includes('card-breath'), '桌面出牌牌复用呼吸');
  const appCssBreath = readFileSync('src/App.css', 'utf8');
  const breathBlock = (appCssBreath.match(/@keyframes cardBreath \{([\s\S]*?)\n\}/) || [])[1] || '';
  assert(appCssBreath.includes('@keyframes cardBreath')
    && appCssBreath.includes('animation: cardBreath 4.6s ease-in-out infinite'),
  'CSS 含 4.6s cardBreath 呼吸动画');
  assert(breathBlock.includes('opacity') && breathBlock.includes('transform')
    && breathBlock.includes('filter') && !/^\s*(top|left|width|height):/m.test(breathBlock),
  'cardBreath keyframes 只动 opacity/transform/filter');
  assert(appCssBreath.includes('.hand-cards > .hand-card-wrap:nth-child(2) .card-breath')
    && appCssBreath.includes('animation-delay: .36s'), '手牌 nth-child 呼吸错峰 0.36s');
  assert(appCssBreath.includes('.game-card:hover .card-breath')
    && appCssBreath.includes('.game-card.selected .card-breath')
    && appCssBreath.includes('animation-duration: 2.9s'), 'hover/selected 呼吸增强');
  assert(appCssBreath.includes('.fly-card .card-breath') && appCssBreath.includes('.discard-card .card-breath')
    && appCssBreath.includes('animation: none'), '飞牌/弃牌期间关闭额外呼吸');
  assert(appCssBreath.includes('.card-breath') && appCssBreath.includes('prefers-reduced-motion')
    && appCssBreath.includes('animation: none !important'), '呼吸含 reduced-motion 降级');
  assert(/\.card-breath \{/.test(appCssBreath)
    && !/\.card-breath::before|\.card-breath::after/.test(appCssBreath), '呼吸层不复用伪元素');

  console.log('\n[42] CC0 采样音效：四类分组 / 映射 / 触发');
  assert(SFX_CATEGORIES.length === 4
    && SFX_CATEGORIES.map(c => c.id).join(',') === 'ui,card,combat,state',
  '音效四类分组：界面/卡牌/战斗/状态');
  assert(SFX_CATEGORIES.every(cat => SFX_SLOTS.some(slot => slot.category === cat.id)),
    '每个音效分类都有槽位');
  assert(SFX_SLOTS.length === 20, '音效槽位共 20 个', SFX_SLOTS.length);
  assert(SFX_SLOTS.every(slot => slot.category && slot.sample && slot.sample.startsWith('/audio/sfx/')),
    '每个槽位都有 category 与内置 sample');
  const sfxKeySet = new Set(SFX_SLOTS.map(slot => slot.key));
  assert(['sfx:select', 'sfx:error', 'sfx:discard'].every(key => sfxKeySet.has(key)),
    '新增 select/error/discard 槽位');
  assert(Object.keys(BUILTIN_SFX).length === 20
    && SFX_SLOTS.every(slot => BUILTIN_SFX[slot.key] === slot.sample),
  'BUILTIN_SFX 由 slots 生成且映射完整');
  const categoryCounts = SFX_CATEGORIES.map(cat => SFX_SLOTS.filter(s => s.category === cat.id).length);
  assert(categoryCounts.every(n => n > 0) && categoryCounts.reduce((a, b) => a + b, 0) === 20,
    '分类数量无空组且合计 20', categoryCounts.join(','));

  const audioSfxSrc = readFileSync('src/audio/audioManager.js', 'utf8');
  assert((audioSfxSrc.match(/'sfx:[a-z]+': 'builtin'/g) || []).length === 20,
    '默认配置 20 个音效槽位均为 builtin');
  assert(audioSfxSrc.includes("slots[slot.key] === 'synth'")
    && audioSfxSrc.includes("slots[slot.key] = 'builtin'"),
  "旧配置 'synth' 迁移 builtin");
  assert(audioSfxSrc.includes('_playSampleSfx') && audioSfxSrc.includes('_fetchSfxSample')
    && audioSfxSrc.includes('decodeAudioData') && audioSfxSrc.includes('0.97 + Math.random() * 0.06'),
  'playSfx 采样 fetch/decode/缓存 + 随机 playbackRate');
  assert(audioSfxSrc.includes('_preloadSfxSamples') && audioSfxSrc.includes('Math.min(concurrency, urls.length)')
    && audioSfxSrc.includes('_sfxBufferCache'), '解锁后并发≤4 预加载采样并缓存');
  assert(audioSfxSrc.includes('_playSynthSfx') && audioSfxSrc.includes("sfxSlot?.sample ? 'builtin' : 'synth'"),
    '采样失败/无 sample 回退合成；removeFile 还原 builtin');
  const handSfxSrc = readFileSync('src/components/GameBoard/HandZone.jsx', 'utf8');
  assert(handSfxSrc.includes("audio.playSfx('select')") && handSfxSrc.includes("audio.playSfx('error')"),
    'HandZone 选中/无效点击播放 select/error');
  const boardSfxSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardSfxSrc.includes("audio.playSfx('discard')"), 'GameBoard discard 事件播放 discard 音效');

  renderPage('AudioSettings(音效分类)', React.createElement(AudioSettings, { onBack: noop }),
    ['音频设置', '界面交互', '卡牌操作', '战斗打击', '战局状态',
      '本类全部试听', '内置 CC0 采样', 'SFX_CREDITS.md']);
  const audioSettingsSrc = readFileSync('src/components/Menu/AudioSettings.jsx', 'utf8');
  assert(audioSettingsSrc.includes('SFX_CATEGORIES.map') && audioSettingsSrc.includes('categorySlots')
    && audioSettingsSrc.includes('内置 CC0 采样') && audioSettingsSrc.includes('public/audio/SFX_CREDITS.md'),
  'AudioSettings 按分类分组并标注 CC0 来源');
  const audioCheckSrc = readFileSync('scripts/audio-check.mjs', 'utf8');
  assert(audioCheckSrc.includes('SFX_SLOTS.length === 20') && audioCheckSrc.includes('OGG/WAV')
    && audioCheckSrc.includes('SFX_CREDITS.md') && audioCheckSrc.includes('SFX_CATEGORIES'),
  'audio-check 覆盖 20 文件/分类/sample 映射');
  assert((audioCheckSrc.match(/SFX_SLOTS\.length === 20/g) || []).length >= 1
    && audioCheckSrc.includes('采样存在'), 'audio-check 逐项检查采样文件存在');

  console.log('\n[43] 手机 APK 面板 / 手机能力提示');
  assert(isMobileApp({ navigator: { userAgent: 'Mozilla/5.0 CGMAndroid/1.0' } }) === true,
    'CGMAndroid UA 识别为手机 App');
  assert(isMobileApp({ __CGM_MOBILE__: true }) === true, '__CGM_MOBILE__ 识别为手机 App');
  assert(isMobileApp({ navigator: { userAgent: 'Mozilla/5.0 Windows NT 10.0 Chrome/120' } }) === false,
    '桌面 UA 不识别为手机 App');
  assert(isMobileDevice({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } }) === true
    && isMobileDevice({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)' } }) === true,
  'iPhone/Android UA 识别为手机设备');
  assert(isMobileDevice({ navigator: { userAgent: 'Windows NT 10.0 Chrome/120' } }) === false,
    '桌面浏览器不识别为手机设备');
  assert(isMobileDevice({ navigator: { maxTouchPoints: 5 }, innerWidth: 800 }) === true
    && isMobileDevice({ navigator: { maxTouchPoints: 5 }, innerWidth: 1300 }) === false,
  '触屏小屏识别为手机设备');
  assert(MOBILE_LIMITATIONS.length >= 4
    && ['local-ai', 'code-ai', 'online-host', 'artifact-build'].every(id => MOBILE_LIMITATIONS.some(item => item.id === id)),
  '手机限制清单覆盖本地 AI/代码 AI/联机/APK');
  assert(MOBILE_LIMITATIONS.every(item => item.label && item.desc), '每条手机限制都有 label/desc');
  assert(mobileDeviceLabel({ __CGM_MOBILE__: true }) === '手机 App'
    && mobileDeviceLabel({ navigator: { userAgent: 'Windows' } }) === '电脑', '设备标签');

  renderPage('MobileNotice(手机版)', React.createElement(MobileNotice, { forceMobile: true }),
    ['手机版', '电脑专属功能', '本地 AI 服务', '代码生成 AI', '联机对战']);
  assert(renderToString(React.createElement(MobileNotice, { forceMobile: false })) === '',
    '桌面端不渲染手机能力提示');

  const apkInfo = normalizeApkInfo({
    file: 'CardGameMaker-1.0.0.apk', size: 12345678, version: '1.0.0',
    url: '/apk/CardGameMaker-1.0.0.apk', mtime: 1760000000000,
  });
  assert(apkInfo && apkInfo.file.endsWith('.apk') && apkInfo.size === 12345678
    && apkInfo.url === '/apk/CardGameMaker-1.0.0.apk', 'normalizeApkInfo 字段');
  assert(normalizeApkInfo(null) === null && normalizeApkInfo({}) === null, '空 APK 信息忽略');
  const apiStatus = normalizeApiStatus({ available: true, building: true, progress: 142, log: ['a', '', 'b'], apk: apkInfo });
  assert(apiStatus.available === true && apiStatus.building === true
    && apiStatus.progress === 100 && apiStatus.log.join(',') === 'a,b'
    && apiStatus.apk.url === '/apk/CardGameMaker-1.0.0.apk', 'normalizeApiStatus 进度/日志/APK');
  const latest = normalizeLatest({
    version: '1.2.3',
    apk: { file: 'x.apk', size: 10 },
    stableUrl: '/apk/CardGameMaker-stable.apk',
    history: [
      { version: '1.2.3', file: 'x.apk', size: 10, url: '/apk/x.apk', mtime: 1760000000000 },
      'https://example.com/apk/old.apk',
    ],
  });
  assert(latest.version === '1.2.3' && latest.apk.file === 'x.apk'
    && latest.stableUrl === '/apk/CardGameMaker-stable.apk'
    && latest.history.length === 2 && latest.history[1].url === 'https://example.com/apk/old.apk',
  'normalizeLatest 两种结构 + stableUrl/history');
  const history = normalizeHistory(Array.from({ length: 8 }, (_, i) => ({
    version: `1.0.${i}`, file: `pkg-${i}.apk`, size: 1000 + i, url: `/apk/pkg-${i}.apk`,
  })));
  assert(history.length === 5 && history[0].version === '1.0.0' && history[4].version === '1.0.4',
    'history 最多保留 5 项');
  assert(normalizeHistory(null).length === 0 && normalizeHistory('bad').length === 0, 'history 非数组优雅忽略');
  assert(buildApkUrl('/apk/a.apk', 'http://192.168.1.8:3000') === 'http://192.168.1.8:3000/apk/a.apk'
    && buildApkUrl('https://x/a.apk') === 'https://x/a.apk'
    && buildApkUrl('apk/a.apk', 'http://h:3000/') === 'http://h:3000/apk/a.apk',
  'APK 下载 URL 拼接');
  assert(formatBytes(12345678) === '11.8 MB' && formatBytes(2048) === '2.0 KB', '文件大小格式化');
  assert(tailLog(['1', '2', '3', '4', '5'], 2).join(',') === '4,5', '日志尾部截取');
  assert(FALLBACK_APP_VERSION === '1.0.0', 'APK 版本兜底常量');

  const apkEmptyHtml = renderToString(React.createElement(MobileApkPanel, {
    previewOnly: true,
    initialStatus: { available: true, building: false, progress: 0, log: [], apk: null },
  }));
  for (const text of ['手机 APK', '一键打包', '无需修改 APK 配置', '旧包自动保留最近 5 个',
    '当前版本', '未打包', '重新检查']) {
    assert(apkEmptyHtml.includes(text), `APK 无包态含「${text}」`);
  }
  assert(!apkEmptyHtml.includes('最近打包'), '无 history 时隐藏最近打包列表');
  const apkReadyHtml = renderToString(React.createElement(MobileApkPanel, {
    previewOnly: true,
    initialStatus: {
      available: true, building: false, progress: 100, log: ['build ok'],
      stableUrl: '/apk/CardGameMaker-stable.apk',
      history: [
        { version: '1.0.1', file: 'CardGameMaker-1.0.1.apk', size: 2222222, url: '/apk/CardGameMaker-1.0.1.apk', mtime: 1760000000000 },
        { version: '1.0.0', file: 'CardGameMaker-1.0.0.apk', size: 1111111, url: '/apk/CardGameMaker-1.0.0.apk', mtime: 1750000000000 },
      ],
      apk: {
        file: 'CardGameMaker-1.0.0.apk', size: 12345678, version: '1.0.0',
        url: '/apk/CardGameMaker-1.0.0.apk', mtime: 1760000000000,
      },
    },
  }));
  for (const text of ['已有安装包', '打包完成', '最新包', '下载 APK', '复制下载链接',
    '11.8 MB', '/apk/CardGameMaker-stable.apk', '最近打包',
    'CardGameMaker-1.0.1.apk', 'v1.0.0']) {
    assert(apkReadyHtml.includes(text), `APK 已打包态含「${text}」`);
  }
  assert(apkReadyHtml.includes('一键打包'), '已有包时仍显示一键打包按钮');
  const apkBuildingHtml = renderToString(React.createElement(MobileApkPanel, {
    previewOnly: true,
    initialStatus: { available: true, building: true, progress: 42, log: ['step1', 'step2'], apk: null },
  }));
  assert(apkBuildingHtml.includes('正在打包') && apkBuildingHtml.includes('42%')
    && apkBuildingHtml.includes('构建日志') && apkBuildingHtml.includes('step2'),
  'APK 打包中进度/日志');
  const apkErrorHtml = renderToString(React.createElement(MobileApkPanel, {
    previewOnly: true,
    initialError: '构建服务不可用：请在电脑端项目目录执行 npm run apk',
  }));
  assert(apkErrorHtml.includes('npm run apk') && apkErrorHtml.includes('构建服务不可用'),
    'APK 接口不可用显示 npm run apk 说明');
  const apkMobileHtml = renderToString(React.createElement(MobileApkPanel, {
    previewOnly: true, forceMobile: true,
    initialStatus: { available: true, building: false, progress: 0, log: [], apk: null },
  }));
  assert(apkMobileHtml.includes('手机版内不支持一键打包') && apkMobileHtml.includes('电脑端'),
    '手机版 APK 提示');

  renderPage('Settings(手机 APK)', React.createElement(Settings, { navigate: noop }),
    ['设置', '手机 APK', '一键打包']);
  const settingsMobileSrc = readFileSync('src/components/Menu/Settings.jsx', 'utf8');
  assert(settingsMobileSrc.includes('MobileApkPanel') && settingsMobileSrc.includes('MobileNotice'),
    'Settings 接入 APK 面板与手机提示');
  const appCssApk = readFileSync('src/App.css', 'utf8');
  assert(appCssApk.includes('.apk-panel') && appCssApk.includes('.apk-progress-bar')
    && appCssApk.includes('.apk-qr') && appCssApk.includes('.mobile-capability-notice'),
  'App.css 含 APK/手机提示样式');
  assert(appCssApk.includes('.apk-explainer') && appCssApk.includes('.apk-complete')
    && appCssApk.includes('.apk-history') && appCssApk.includes('.apk-history-item'),
  'App.css 含一键打包说明/完成/历史样式');

  console.log('\n[44] 出牌手感：悬浮确认条 / 推荐高亮 / AI 思考节奏');
  const barHtml = renderToString(React.createElement(QuickPlayBar, {
    card: { name: '杀', suit: 'spade', numberDisplay: '7' },
    targetName: 'AI1',
    canConfirm: true,
    onConfirm: noop,
    onCancel: noop,
  }));
  for (const text of ['quick-play-bar', '杀', '→ AI1', '确认出牌', '取消']) {
    assert(barHtml.includes(text), `悬浮出牌条含「${text}」`);
  }
  assert(renderToString(React.createElement(QuickPlayBar, { card: null })) === '',
    '未选中手牌不渲染悬浮出牌条');
  const barDisabledHtml = renderToString(React.createElement(QuickPlayBar, {
    card: { name: '杀' }, targetName: '', canConfirm: false, onConfirm: noop, onCancel: noop,
  }));
  assert(barDisabledHtml.includes('disabled'), '需要目标未选时确认按钮禁用');
  const thinkHtml = renderToString(React.createElement(AiThinkingBadge, {
    visible: true, name: 'AI2',
  }));
  assert(thinkHtml.includes('AI2 思考中…') && thinkHtml.includes('ai-thinking-dots')
    && (thinkHtml.match(/<i><\/i>/g) || []).length === 3, 'AI 思考徽标含三点脉冲');
  assert(renderToString(React.createElement(AiThinkingBadge, { visible: false })) === '',
    '非 AI 回合不渲染思考徽标');

  assert(HAND_DRAG_THRESHOLD >= 10 && HAND_DRAG_THRESHOLD <= 12,
    '手牌拖拽阈值 10~12px', HAND_DRAG_THRESHOLD);
  const handV2Src = readFileSync('src/components/GameBoard/HandZone.jsx', 'utf8');
  assert(handV2Src.includes('< HAND_DRAG_THRESHOLD') && handV2Src.includes('recommendedKey')
    && handV2Src.includes('recommended-card') && handV2Src.includes('hand-recommend-badge'),
  'HandZone 使用阈值与推荐高亮/角标');
  const boardV2Src = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardV2Src.includes('recommendedKey={recommendedKey}')
    && boardV2Src.includes('<QuickPlayBar') && boardV2Src.includes('<AiThinkingBadge')
    && boardV2Src.includes('quickPlayCanConfirm'), 'GameBoard 接入悬浮条/推荐/AI 徽标');
  const recommendSection = boardV2Src.slice(
    boardV2Src.indexOf('const handleRecommend'),
    boardV2Src.indexOf('const clearSelection'),
  );
  assert(recommendSection.length > 0 && !recommendSection.includes('setTimeout')
    && !recommendSection.includes('resolveAction(')
    && recommendSection.includes('setSelectedCards([result.card])')
    && recommendSection.includes('setRecommendedKey(cardKey(result.card))'),
  '推荐只选中+高亮，不自动 resolveAction');
  assert(boardV2Src.includes('确认出牌或取消') && boardV2Src.includes('无可出牌，可结束出牌'),
    '推荐提示文案');

  assert(normalizeAiDelay(undefined) === AI_DELAY_DEFAULT
    && AI_DELAY_DEFAULT === 900 && AI_DELAY_MIN === 700 && AI_DELAY_MAX === 1800,
  'AI 延迟默认 900 / 范围 700~1800');
  assert(normalizeAiDelay(500) === 700 && normalizeAiDelay(5000) === 1800
    && normalizeAiDelay(1200) === 1200 && normalizeAiDelay('abc') === 900,
  'AI 延迟 clamp 与非法值兜底');
  const storeV2Src = readFileSync('src/store/gameStore.js', 'utf8');
  assert((storeV2Src.match(/aiPause\(readAiDelay\(\)\)/g) || []).length === 2
    && storeV2Src.includes("localStorage.getItem('cgm_game_config')")
    && storeV2Src.includes('cfg?.aiDelay'), 'AI askForPlay 读取 cgm_game_config.aiDelay 并等待');
  assert((storeV2Src.match(/await aiPause\(340\)/g) || []).length >= 1,
    '弃牌/响应保持 300~500ms 节奏');
  const settingsV2Src = readFileSync('src/components/Menu/Settings.jsx', 'utf8');
  assert(settingsV2Src.includes('min={400} max={2000}')
    && settingsV2Src.includes("value={gameConfig.aiDelay || 900}")
    && settingsV2Src.includes('实际生效范围 700~1800ms'),
  'Settings AI 延迟默认 900/范围 400~2000/说明');
  const appCssHand = readFileSync('src/App.css', 'utf8');
  for (const key of ['quickPlayBarIn', 'recommendBadgePulse', 'aiThinkingDot']) {
    assert(appCssHand.includes('@keyframes ' + key), `App.css 含出牌手感 keyframes ${key}`);
  }
  assert(appCssHand.includes('.quick-play-bar') && appCssHand.includes('.recommended-card')
    && appCssHand.includes('.ai-thinking-badge')
    && appCssHand.includes('prefers-reduced-motion'), '出牌手感样式与降级');

  console.log('\n[45] 平台自适应：电脑右侧操作栏 / 手机底部触控布局');
  assert(getPlatform({ __CGM_MOBILE__: true }) === 'mobile', 'App 全局变量判手机');
  assert(getPlatform({ navigator: { userAgent: 'Mozilla/5.0 CGMAndroid/1.0' } }) === 'mobile',
    'CGMAndroid UA 判手机');
  assert(getPlatform({ innerWidth: 390 }) === 'mobile', '窄屏 ≤760 判手机');
  assert(getPlatform({ innerWidth: 844, matchMedia: () => ({ matches: true }) }) === 'mobile',
    '844 横屏触屏判手机');
  assert(getPlatform({ innerWidth: 844, innerHeight: 390 }) === 'mobile',
    '844×390 手机横屏判手机');
  assert(getPlatform({ innerWidth: 1024, matchMedia: () => ({ matches: true }) }) === 'desktop',
    '1024 及以上判电脑');
  assert(getPlatform({ innerWidth: 1440, navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }) }) === 'desktop',
    '桌面宽屏判电脑');
  assert(isTouchInput({ navigator: { maxTouchPoints: 5 } }) === true
    && isTouchInput({ navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: true }) }) === true
    && isTouchInput({ navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }) }) === false,
  '触控输入判定');

  const appPlatformHtml = renderToString(React.createElement(App));
  assert(appPlatformHtml.includes('data-platform="desktop"') && appPlatformHtml.includes('data-input="mouse"'),
    'App SSR 根节点带 data-platform/data-input');
  const appPlatformSrc = readFileSync('src/App.jsx', 'utf8');
  assert(appPlatformSrc.includes('usePlatform') && appPlatformSrc.includes('data-platform={platform}')
    && appPlatformSrc.includes('data-input={inputMode}'), 'App 接入平台检测');
  const mobilePlatformSrc = readFileSync('src/utils/mobile.js', 'utf8');
  assert(mobilePlatformSrc.includes('export function usePlatform')
    && mobilePlatformSrc.includes("addEventListener('resize'")
    && mobilePlatformSrc.includes('matchMedia'), 'usePlatform 监听 resize/matchMedia');

  const appCssPlatform = readFileSync('src/App.css', 'utf8');
  assert(appCssPlatform.includes('@media (min-width: 1024px)')
    && appCssPlatform.includes('[data-platform="desktop"] .board-center .action-panel')
    && appCssPlatform.includes('position: fixed !important')
    && appCssPlatform.includes('right: 24px !important')
    && appCssPlatform.includes('width: 360px !important')
    && appCssPlatform.includes('max-height: calc(100vh - 190px)'),
  '桌面 ActionPanel 固定右侧操作栏');
  assert(appCssPlatform.includes('[data-platform="desktop"] .settings-content')
    && appCssPlatform.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')
    && appCssPlatform.includes('max-width: 1200px'), '桌面设置页两列');
  assert(appCssPlatform.includes('[data-platform="desktop"] .hand-zone .game-card')
    && appCssPlatform.includes('width: calc(96px * var(--hand-scale, 1))'), '桌面手牌加大');
  assert(appCssPlatform.includes('[data-platform="desktop"] .quick-play-bar')
    && appCssPlatform.includes('[data-platform="desktop"] .log-panel-right')
    && appCssPlatform.includes('right: 400px'), '桌面悬浮条/日志右栏避让操作栏');
  assert(appCssPlatform.includes('[data-platform="mobile"] .board-center .action-panel')
    && appCssPlatform.includes('max-height: 45vh')
    && appCssPlatform.includes('position: relative !important'), '手机 ActionPanel 底部流内面板');
  assert(appCssPlatform.includes('[data-platform="mobile"] .hand-zone .game-card')
    && appCssPlatform.includes('width: calc(72px * var(--hand-scale, 1))')
    && appCssPlatform.includes('min-width: 72px'), '手机手牌全宽至少 72px');
  assert(appCssPlatform.includes('[data-platform="mobile"] .btn,')
    && appCssPlatform.includes('min-height: 44px'), '手机按钮 44px 触控高度');
  assert(appCssPlatform.includes('[data-platform="mobile"] .quick-play-bar')
    && appCssPlatform.includes('position: static'), '手机 QuickPlayBar 流内不压手牌');
  assert(appCssPlatform.includes('env(safe-area-inset-bottom)')
    && appCssPlatform.includes('overflow-x: hidden')
    && appCssPlatform.includes('width: min(88vw, 420px)'), '手机安全区/无横向溢出/日志抽屉');
  assert(appCssPlatform.includes('[data-platform="mobile"] .game-card')
    && appCssPlatform.includes('--tilt-x: 0deg !important'), '手机触控禁用 tilt');

  console.log('\n[46] 技能描述语义着色');
  const mixedSkill = '限定技，出牌阶段限一次：使用【杀】时，你可以摸1张牌并造成2点伤害。';
  const mixedTokens = tokenizeSkillText(mixedSkill);
  assert(joinSkillTokens(mixedTokens) === mixedSkill, '语义 token 重组等于原文（不丢字）');
  assert(mixedTokens.some(t => t.type === 'limited' && t.text === '限定技'), '识别限定技');
  assert(mixedTokens.some(t => t.type === 'timing' && t.text === '出牌阶段'), '识别出牌阶段');
  assert(tokenizeSkillText('【杀】').some(t => t.type === 'card' && t.text === '【杀】'), '独立牌名【杀】');
  assert(mixedTokens.some(t => t.type === 'effect' && t.text === '摸1张牌'), '识别摸牌效果');
  assert(mixedTokens.some(t => t.type === 'effect' && t.text === '造成2点伤害'), '识别伤害效果');
  assert(mixedTokens.every(t => t.text && t.type), '所有 token 非空且有 type');
  assert(tokenizeSkillText('').length === 0 && tokenizeSkillText(null).length === 0, '空文本返回空 token');
  assert(joinSkillTokens(tokenizeSkillText('普通描述，没有关键词。')) === '普通描述，没有关键词。'
    && tokenizeSkillText('普通描述，没有关键词。').every(t => t.type === 'plain'), '纯文本保持 plain');
  for (const [text, type] of [
    ['限定技', 'limited'], ['觉醒技', 'awakening'], ['锁定技', 'locked'],
    ['使命技', 'mission'], ['转换技', 'transform'],
    ['每回合限一次', 'frequency'], ['每轮限一次', 'frequency'],
    ['每阶段限一次', 'frequency'], ['每局一次', 'frequency'],
    ['出牌阶段', 'timing'], ['受到伤害后', 'timing'],
    ['【闪】', 'card'], ['摸1张牌', 'effect'],
  ]) {
    const tokens = tokenizeSkillText(text);
    assert(tokens.length === 1 && tokens[0].type === type, `token 类型 ${text} → ${type}`);
  }
  const numberTokens = tokenizeSkillText('距离为2');
  assert(numberTokens.some(t => t.type === 'number' && t.text === '2'), '识别数字');
  assert(tokenizeSkillText('使用【杀】时').some(t => t.type === 'timing' && t.text === '使用【杀】时'),
    '使用【杀】时整体识别为时机');
  assert(SKILL_KEYWORD_GROUPS.length >= 10
    && ['limited', 'awakening', 'locked', 'mission', 'frequency', 'timing', 'card', 'effect', 'number']
      .every(type => SKILL_KEYWORD_GROUPS.some(g => g.type === type)),
  'SKILL_KEYWORD_GROUPS 覆盖所有语义类别');

  const skillTextHtml = renderToString(React.createElement(SkillText, {
    text: '限定技 每回合限一次 出牌阶段 【杀】 摸1张牌 2',
  }));
  for (const cls of ['skill-kw--limited', 'skill-kw--frequency', 'skill-kw--timing',
    'skill-kw--card', 'skill-kw--effect', 'skill-kw--number']) {
    assert(skillTextHtml.includes(cls), `SkillText SSR 含 ${cls}`);
  }
  assert(renderToString(React.createElement(SkillText, { text: '' })) === '', 'SkillText 空文本不渲染');
  const skillTextSrc = readFileSync('src/components/ui/SkillText.jsx', 'utf8');
  assert(!skillTextSrc.includes('dangerouslySetInnerHTML'), 'SkillText 不使用 innerHTML');
  const legendHtml = renderToString(React.createElement(SkillKeywordLegend, {}));
  for (const text of ['限定技', '每回合限一次', '受到伤害后', '【杀】', '摸1张牌', 'skill-kw-legend']) {
    assert(legendHtml.includes(text), `颜色图例含「${text}」`);
  }
  assert(skillTypeInfo({ type: 'limited' }).key === 'limited'
    && skillTypeInfo({ type: 'awakening' }).label === '觉醒'
    && skillTypeInfo({ type: 'mission' }).key === 'mission', '技能类型徽标补齐 limited/awakening/mission');

  renderPage('SkillEditor(描述预览)', React.createElement(SkillEditor, { navigate: noop }),
    ['描述预览', '限定技', '每回合限一次', '【杀】', '摸1张牌']);
  renderPage('SkillComposer(描述预览)', React.createElement(SkillComposer, { onApply: noop }),
    ['实时描述预览', '限定技', '每回合限一次', '【杀】', '摸1张牌']);
  const guideSkillHtml = renderToString(React.createElement(CardGuide, { onClose: noop }));
  assert(guideSkillHtml.includes('skill-text') && guideSkillHtml.includes('skill-kw'), 'CardGuide 使用语义着色');
  const skillIntegrationSrcs = [
    'src/components/GameBoard/CardGuide.jsx',
    'src/components/Editor/CharacterCardPreview.jsx',
    'src/components/GameBoard/GameBoard.jsx',
    'src/components/Editor/SkillEditor.jsx',
    'src/components/Editor/SkillComposer.jsx',
    'src/components/Editor/CharacterEditor.jsx',
  ];
  for (const file of skillIntegrationSrcs) {
    assert(readFileSync(file, 'utf8').includes('SkillText'), `${file} 接入 SkillText`);
  }
  const gameBoardSkillSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(gameBoardSkillSrc.includes('<SkillText text={sk.description'), 'GameBoard 武将卡说明语义着色');
  const playerAreaSkillSrc = readFileSync('src/components/GameBoard/PlayerArea.jsx', 'utf8');
  assert(playerAreaSkillSrc.includes('title={`${t.title}') && !playerAreaSkillSrc.includes('<SkillText'),
    'PlayerArea tooltip 保持纯文本');
  const appCssSkillKw = readFileSync('src/App.css', 'utf8');
  for (const cls of ['skill-kw--limited', 'skill-kw--awakening', 'skill-kw--locked',
    'skill-kw--mission', 'skill-kw--transform', 'skill-kw--frequency', 'skill-kw--timing',
    'skill-kw--card', 'skill-kw--effect', 'skill-kw--number',
    'skill-type-badge.limited', 'skill-type-badge.awakening', 'skill-type-badge.mission']) {
    assert(appCssSkillKw.includes('.' + cls), `App.css 含 ${cls}`);
  }
  assert(appCssSkillKw.includes('.skill-desc-preview-box') && appCssSkillKw.includes('.skill-kw-legend'),
    'App.css 含描述预览/图例样式');

  console.log('\n[47] 自绘下拉 / 表单控件一致性');
  const selectHtml = renderToString(React.createElement(Select, {
    id: 'demo-select', value: 'b', onChange: noop, className: 'demo-select',
  }, [
    React.createElement('option', { key: 'a', value: 'a' }, '甲'),
    React.createElement('option', { key: 'b', value: 'b' }, '乙'),
    React.createElement('option', { key: 'c', value: 'c', disabled: true }, '丙'),
  ]));
  for (const text of ['ui-select-trigger', 'ui-select-native', 'demo-select',
    'id="demo-select"', '乙', 'role="combobox"', 'aria-expanded="false"',
    'ui-select-chevron', 'option value="b"']) {
    assert(selectHtml.includes(text), `Select SSR 含「${text}」`);
  }
  assert(selectHtml.includes('disabled=""') || selectHtml.includes('disabled'), 'disabled option/属性保留');
  const disabledSelectHtml = renderToString(React.createElement(Select, {
    id: 'disabled-select', value: 'x', disabled: true, onChange: noop,
  }, [React.createElement('option', { key: 'x', value: 'x' }, 'X')]));
  assert(disabledSelectHtml.includes('disabled'), 'Select disabled 透传 trigger/native');
  const options = collectSelectOptions([
    React.createElement(React.Fragment, { key: 'f' }, [
      React.createElement('option', { key: '1', value: 'one' }, '一'),
      React.createElement('option', { key: '2', value: 'two', disabled: true }, '二'),
    ]),
    React.createElement('optgroup', { key: 'g', label: '组' },
      React.createElement('option', { key: '3', value: 'three' }, '三')),
  ]);
  assert(options.length === 3 && options[0].value === 'one' && options[1].disabled
    && options[2].value === 'three', 'collectSelectOptions 支持 Fragment/optgroup/disabled');
  const selectSrc = readFileSync('src/components/ui/Select.jsx', 'utf8');
  assert(!selectSrc.includes('dangerouslySetInnerHTML'), 'Select 不使用 innerHTML');
  assert(selectSrc.includes('createPortal') && selectSrc.includes('role="listbox"')
    && selectSrc.includes('ui-select-menu') && selectSrc.includes('drop-up'),
  'Select 使用 portal/listbox/drop-up');

  // 源码审计：除 Select.jsx 外不得有原生 <select>
  const walkComponentFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walkComponentFiles(path) : [path];
  });
  const allComponentFiles = walkComponentFiles('src/components')
    .filter(file => /\.(jsx?|mjs)$/.test(file));
  const nativeSelectOffenders = allComponentFiles
    .filter(file => !file.endsWith('Select.jsx') && readFileSync(file, 'utf8').includes('<select'))
    .map(file => file.replace(/\\/g, '/'));
  assert(nativeSelectOffenders.length === 0, '除 Select.jsx 外无原生 <select>', nativeSelectOffenders.join(','));
  const selectTagCount = allComponentFiles
    .filter(file => !file.endsWith('Select.jsx'))
    .reduce((sum, file) => sum + ((readFileSync(file, 'utf8').match(/<Select\b/g) || []).length), 0);
  assert(selectTagCount >= 27, '至少 27 处原生下拉替换为 Select', String(selectTagCount));
  const componentSourceAll = allComponentFiles
    .filter(file => !file.endsWith('Select.jsx'))
    .map(file => readFileSync(file, 'utf8')).join('\n');
  for (const key of ['voice-provider', 'ws-sex', 'ws-group', 'audio-select', 'team-mode-select']) {
    assert(componentSourceAll.includes(key), `关键 id/class 保留：${key}`);
  }
  const checkboxCount = (componentSourceAll.match(/type="checkbox"/g) || []).length;
  assert(checkboxCount >= 15, '复选框全部走统一自绘样式', String(checkboxCount));

  const appCssForm = readFileSync('src/App.css', 'utf8');
  assert(appCssForm.includes('.ui-select-trigger') && appCssForm.includes('.ui-select-menu')
    && appCssForm.includes('.ui-select-option') && appCssForm.includes('.ui-select-native'),
  'App.css 含自绘下拉结构样式');
  for (const key of ['selectPop', 'selectOptionIn']) {
    assert(appCssForm.includes('@keyframes ' + key), `App.css 含 ${key} 弹性动画`);
  }
  assert(appCssForm.includes('.ui-select.open .ui-select-chevron')
    && appCssForm.includes('transform: rotate(180deg)'), 'chevron open 旋转');
  assert(appCssForm.includes('.ui-select-menu.drop-up') && appCssForm.includes('transform-origin: bottom center'),
    'drop-up 适配');
  assert(appCssForm.includes('input[type="checkbox"]') && appCssForm.includes('appearance: none')
    && appCssForm.includes('input[type="checkbox"]:checked::after'), '复选框自绘');
  assert(appCssForm.includes('input[type="checkbox"]:focus-visible')
    && appCssForm.includes('input[type="checkbox"]:disabled'), '复选框焦点/禁用态');
  assert(appCssForm.includes('.ui-select-option { min-height: 40px')
    || (appCssForm.includes('@media (max-width: 760px)') && appCssForm.includes('min-height: 40px')),
  '手机下拉项 40px');
  assert(appCssForm.includes('safe-area-inset-bottom') && appCssForm.includes('max-height: min(50vh, 300px)'),
    '手机下拉 safe-area/高度限制');
  assert(!appCssForm.includes('.ui-select-trigger::after')
    && selectSrc.includes('<Icon name="chevron-down"'), '自绘 chevron 非系统箭头');

  console.log('\n[48] 卜卦判定特写：八卦流转 + 牌影汇聚 + 翻牌揭晓');
  const divinationFx = {
    kind: 'judge', player: '关羽', delayCard: '闪电', success: true,
    card: { name: '闪电', suitSymbol: '♠', numberDisplay: 'A', isRed: false },
  };
  const divinationHtml = renderToString(React.createElement(JudgeReveal, { fx: divinationFx }));
  for (const text of ['fx-divination', 'fx-divination-veil', 'fx-divination-rings',
    'fx-divination-orbit', 'fx-divination-trigram', 'fx-divination-card-back',
    'fx-judge', 'data-fx="judge"', 'fx-judge-title', 'fx-judge-card',
    'fx-judge-suit', 'fx-judge-name', 'fx-judge-num', 'fx-judge-result',
    'fx-judge-player', '判定生效', '关羽', '闪电', 'success']) {
    assert(divinationHtml.includes(text), `卜卦特写 SSR 含「${text}」`);
  }
  assert((divinationHtml.match(/fx-divination-card-back/g) || []).length === 3, '3 张飞入牌影');
  assert((divinationHtml.match(/fx-divination-trigram/g) || []).length === 8, '八卦 8 个卦象字');
  const divinationFailHtml = renderToString(React.createElement(JudgeReveal, {
    fx: { ...divinationFx, success: false, card: { name: '桃', suitSymbol: '♥', numberDisplay: '7', isRed: true } },
  }));
  assert(divinationFailHtml.includes('fx-judge fail') && divinationFailHtml.includes('判定不中'),
    '卜卦特写保留 fail 状态');
  const judgeDurationFx = mapEffectToFx({ type: 'judge', card: { name: '闪电' }, success: true });
  assert(judgeDurationFx.duration === 1900, 'judge 特效时长约 1900ms', String(judgeDurationFx.duration));

  const appCssDivination = readFileSync('src/App.css', 'utf8');
  for (const key of ['fxDivinationFrame', 'fxDivinationVeil', 'fxDivinationRingsIn',
    'fxDivinationRing', 'fxDivinationOrbit', 'fxDivinationCardIn',
    'fxDivinationResultIn', 'fxDivinationInk']) {
    assert(appCssDivination.includes('@keyframes ' + key), `App.css 含 ${key}`);
  }
  assert(appCssDivination.includes('.fx-divination .fx-judge-card')
    && appCssDivination.includes('animation: fxDivinationCardIn 0.5s 0.65s'), '主牌延迟 0.65s 翻开');
  assert(appCssDivination.includes('animation-delay: calc(0.15s + var(--i, 0) * 0.07s)'),
    '牌影错峰飞入');
  assert(appCssDivination.includes('rotateY(-90deg)') && appCssDivination.includes('scale(.72)'),
    '主牌 3D 翻开 + 0.72 放大');
  const divinationCardBlock = (appCssDivination.match(/@keyframes fxDivinationCardIn \{([\s\S]*?)\n\}/) || [])[1] || '';
  assert(divinationCardBlock.includes('transform') && divinationCardBlock.includes('opacity')
    && !divinationCardBlock.includes('filter') && !divinationCardBlock.includes('box-shadow'),
  '翻牌 keyframes 只动 transform/opacity');
  assert(appCssDivination.includes('@media (max-width: 760px)')
    && appCssDivination.includes('width: 88px') && appCssDivination.includes('height: 122px'),
  '移动端判定牌 88×122 适配');
  const divinationReducedStart = appCssDivination.indexOf('@media (prefers-reduced-motion: reduce) {\n  .fx-divination {');
  const divinationReducedBlock = divinationReducedStart >= 0
    ? appCssDivination.slice(divinationReducedStart, divinationReducedStart + 1200)
    : '';
  assert(divinationReducedStart >= 0
    && divinationReducedBlock.includes('.fx-divination-rings')
    && divinationReducedBlock.includes('display: none !important')
    && divinationReducedBlock.includes('.fx-divination .fx-judge-card'), '卜卦 reduced-motion 静态降级');

  console.log('\n[49] 装备栏 3 框 + 满槽替换 + 装备栏数量');
  assert(normalizeEquipLimit(undefined) === 3 && normalizeEquipLimit(0) === 1
    && normalizeEquipLimit(99) === 6 && normalizeEquipLimit('4') === 4,
  '装备栏数量 clamp 1~6、缺省 3');
  const equipSlots3 = buildEquipSlots({
    equipLimit: 3,
    equipCards: [{ name: '青龙偃月刀', type: 'weapon', suitSymbol: '♠' }],
  });
  assert(equipSlots3.limit === 3 && equipSlots3.used === 1 && equipSlots3.slots.length === 3
    && equipSlots3.slots[0].card.name === '青龙偃月刀'
    && equipSlots3.slots[1].card === null && equipSlots3.title === '装备 (1/3)',
  'buildEquipSlots 固定 3 框 + 已用/上限');
  const oldEquipSlots = buildEquipSlots({
    equips: { weapon: { name: '雌雄双股剑', type: 'weapon' }, armor: { name: '八卦阵', type: 'armor' } },
  });
  assert(oldEquipSlots.limit === 3 && oldEquipSlots.used === 2 && oldEquipSlots.slots.length === 3,
    '旧 equips 对象回退 3 框');
  assert(equipChoiceEntries([{ name: 'A' }, null, { name: 'B' }]).length === 2
    && equipChoiceEntries({ weapon: { name: 'A' }, armor: null }).length === 1,
  'equipChoiceEntries 数组/对象兼容');
  assert(normalizeEquipChoiceEntries([{ name: 'A' }])[0].slotKey === '0'
    && normalizeEquipChoiceEntries({ weapon: { name: 'A' } })[0].slotKey === 'weapon',
  'store 装备替换选项归一化');

  const player4Html = renderToString(React.createElement(PlayerArea, {
    player: {
      id: 'p4', name: '关羽', hp: 4, maxHp: 4, status: 'alive',
      equipLimit: 4,
      equipCards: [
        { name: '青龙偃月刀', type: 'weapon', suitSymbol: '♠' },
        { name: '八卦阵', type: 'armor', suitSymbol: '♣' },
      ],
    },
    isSelf: false, isCurrent: false, selectable: false,
    selectedCards: [], onCardSelect: noop,
  }));
  assert((player4Html.match(/class="equip-slot (?:filled|empty)/g) || []).length === 4,
    'equipLimit=4 渲染 4 框');
  assert(player4Html.includes('装备 (2/4)') && player4Html.includes('青龙偃月刀')
    && player4Html.includes('武器') && player4Html.includes('＋'),
  'PlayerArea 装备计数/牌名/类型/空框');
  const selfEquipHtml = renderToString(React.createElement(SelfCharacterCard, {
    player: { id: 's1', name: '你', hp: 3, maxHp: 3, status: 'alive', equips: {} },
  }));
  assert((selfEquipHtml.match(/class="equip-slot empty self-equip-slot"/g) || []).length === 3,
    'SelfCharacterCard 默认 3 个空装备框');

  const replaceAction = {
    type: 'equipReplace',
    newCard: { name: '青龙偃月刀', type: 'weapon', suitSymbol: '♠' },
    cards: [
      { name: '雌雄双股剑', type: 'weapon', suitSymbol: '♣' },
      { name: '八卦阵', type: 'armor', suitSymbol: '♦' },
    ],
    limit: 2,
  };
  const replaceHtml = renderToString(React.createElement(ActionPanel, {
    action: replaceAction, onResolve: noop,
    selectedCards: [], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, onRecommend: noop, recommendHint: null, onInfo: noop,
  }));
  for (const text of ['装备栏已满，必须弃置一张装备', '旧装备进入弃牌堆，新装备放入该槽',
    '青龙偃月刀', '雌雄双股剑', '八卦阵', '替换并弃置', '查看说明', '槽位 1']) {
    assert(replaceHtml.includes(text), `equipReplace 弹窗含「${text}」`);
  }
  assert(replaceHtml.includes('disabled') && !replaceHtml.includes('取消'),
    '未选槽位时确认禁用且无取消');
  const replaceSelectedHtml = renderToString(React.createElement(ActionPanel, {
    action: replaceAction, onResolve: noop,
    selectedCards: [], setSelectedCards: noop,
    selectedTarget: null, setSelectedTarget: noop,
    game: null, onRecommend: noop, recommendHint: null, onInfo: noop,
    initialEquipChoice: '1',
  }));
  assert(replaceSelectedHtml.includes('equip-replace-option selected')
    && replaceSelectedHtml.includes('✓'), '选择槽位后高亮/勾选');

  const storeEquipSrc = readFileSync('src/store/gameStore.js', 'utf8');
  assert((storeEquipSrc.match(/game\.ui\.askForEquipReplace/g) || []).length === 3,
    '两处 askForEquipReplace 绑定（本地/联机 host）+ dispose 清理');
  assert(storeEquipSrc.includes("type: 'equipReplace'")
    && storeEquipSrc.includes('askForEquipReplace = null')
    && storeEquipSrc.includes("pendingAction.type === 'equipReplace'")
    && storeEquipSrc.includes('firstEquipSlot(current)'), 'store 弹窗/resolve/dispose/AI 回退');
  const boardEquipSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardEquipSrc.includes("pa.type === 'equipReplace'") && boardEquipSrc.includes('firstEquipSlot(pa.cards)'),
    'autoPlay 处理 equipReplace 不挂起');
  const actionEquipSrc = readFileSync('src/components/GameBoard/ActionPanel.jsx', 'utf8');
  assert(actionEquipSrc.includes("type === 'equipReplace'") && actionEquipSrc.includes('initialEquipChoice'),
    'ActionPanel 接入 equipReplace 弹窗');

  assert(blankCharacterForm().equipSlots === 3
    && normalizeCharacterForm({}).equipSlots === 3
    && normalizeCharacterForm({ equipSlots: 99 }).equipSlots === 6
    && normalizeCharacterForm({ equipSlots: 0 }).equipSlots === 1,
  '角色表单装备栏默认 3 / clamp 1~6');
  const equipImport = extractCharacterImport({ name: '关羽', faction: 'shu', hp: 4, equipSlots: 5 }, []);
  assert(equipImport.ok && equipImport.form.equipSlots === 5, '导入 JSON 保留 equipSlots');
  const equipExport = buildCharacterExport(blankCharacterForm());
  assert(equipExport.equipSlots === 3, '导出 JSON 带 equipSlots');
  const editorEquipHtml = renderToString(React.createElement(CharacterEditor, {
    navigate: noop, initialForm: { name: '关羽', hp: 4, maxHp: 4, equipSlots: 4 },
  }));
  assert(editorEquipHtml.includes('装备栏数量') && editorEquipHtml.includes('id="ws-equip"')
    && editorEquipHtml.includes('min="1"') && editorEquipHtml.includes('max="6"')
    && editorEquipHtml.includes('满后替换需选择弃置'), 'CharacterEditor 装备栏数量字段');
  const previewEquipHtml = renderToString(React.createElement(CharacterCardPreview, {
    form: { name: '关羽', hp: 4, maxHp: 4, equipSlots: 4 }, skills: [],
  }));
  assert((previewEquipHtml.match(/class="workshop-equip-slot"/g) || []).length === 4,
    '工坊卡面预览 4 个装备框');
  const appCssEquip = readFileSync('src/App.css', 'utf8');
  assert(appCssEquip.includes('.equip-slot') && appCssEquip.includes('.equip-slot.empty')
    && appCssEquip.includes('.equip-replace-warning') && appCssEquip.includes('.equip-replace-option.selected')
    && appCssEquip.includes('.workshop-equip-slot'), 'App.css 装备框/替换弹窗/预览样式');
  assert(appCssEquip.includes('@media (max-width: 760px)')
    && appCssEquip.includes('min-height: 44px') && appCssEquip.includes('min-width: 64px'),
  '移动端装备框/触控尺寸');

  console.log('\n[50] 观战模式：大厅入口 + 只读牌桌/观战栏');
  const spectatorLobbyOnline = {
    active: true,
    connected: true,
    isHost: false,
    roomCode: 'SP01',
    seat: null,
    spectator: true,
    role: 'spectator',
    playerCount: 2,
    spectatorCount: 1,
    members: [
      { name: '房主甲', seat: 0 },
      { name: '玩家乙', seat: 1 },
      { name: '观众丙', seat: null, spectator: true },
    ],
    spectators: [{ name: '观众丙', spectator: true }],
  };
  const spectatorLobbyHtml = renderToString(React.createElement(OnlineLobby, {
    navigate: noop, initialOnline: spectatorLobbyOnline,
  }));
  for (const text of ['观战中', '不占座位，仅观看对局', '玩家 2', '观战 1',
    '玩家乙', '观众丙', '离开房间', '复制邀请链接']) {
    assert(spectatorLobbyHtml.includes(text), `观战大厅含「${text}」`);
  }
  assert(!spectatorLobbyHtml.includes('对局人数') && !spectatorLobbyHtml.includes('正在开局')
    && spectatorLobbyHtml.includes('观战者不占座位'), '观战大厅隐藏开始对局/人数选择');

  const spectatorPlayers = [
    {
      id: 'p1', name: '房主甲', seatNum: 0, status: 'alive', hp: 3, maxHp: 4,
      handCards: [{ id: 'c1', name: '杀' }], handCardCount: 2, equips: {}, judgeCards: [],
      skills: [], character: { name: '关羽' },
    },
    {
      id: 'p2', name: '玩家乙', seatNum: 1, status: 'alive', hp: 4, maxHp: 4,
      handCards: [], handCardCount: 3, equips: {}, judgeCards: [], skills: [],
      character: { name: '张飞' },
    },
  ];
  const spectatorState = {
    status: 'running', round: 2, currentPhase: 'play', currentPlayer: spectatorPlayers[0],
    players: spectatorPlayers, deckInfo: { remaining: 12, total: 24, discarded: 3 }, teamMode: 'ffa',
  };
  const spectatorPreview = {
    gameState: spectatorState,
    game: null,
    effect: null,
    logs: [{ message: '观战日志' }],
    pendingAction: { type: 'play', player: spectatorPlayers[0], resolve: noop },
    online: {
      active: true, connected: true, isHost: false, roomCode: 'SP01',
      seat: null, spectator: true, role: 'spectator', playerCount: 2, spectatorCount: 1,
    },
  };
  const spectatorBoardHtml = renderToString(React.createElement(GameBoard, { navigate: noop, preview: spectatorPreview }));
  for (const text of ['观战中', 'spectator-panel', 'SP01', '玩家', '观战',
    '牌堆', '查看日志', '退出观战', '房主甲', '玩家乙', '第', '回合']) {
    assert(spectatorBoardHtml.includes(text), `观战牌桌含「${text}」`);
  }
  assert(!spectatorBoardHtml.includes('class="hand-zone') && !spectatorBoardHtml.includes('class="action-panel'),
    '观战牌桌不渲染手牌区/ActionPanel');
  assert(!spectatorBoardHtml.includes('结束出牌') && !spectatorBoardHtml.includes('推荐出牌'),
    '观战牌桌无出牌操作文案');
  assert(spectatorBoardHtml.includes('spectator-tip') && spectatorBoardHtml.includes('只读'),
    '观战栏只读提示');
  const normalPreview = {
    ...spectatorPreview,
    online: { active: true, connected: true, isHost: true, roomCode: 'N01', seat: 0, spectator: false, role: 'player' },
    pendingAction: null,
  };
  const normalBoardHtml = renderToString(React.createElement(GameBoard, { navigate: noop, preview: normalPreview }));
  assert(normalBoardHtml.includes('class="hand-zone') && !normalBoardHtml.includes('spectator-panel'),
    '普通玩家仍保留手牌/无观战栏');
  const spectatorWaitingHtml = renderToString(React.createElement(GameBoard, {
    navigate: noop,
    preview: { online: { active: true, connected: true, roomCode: 'SP01', spectator: true, role: 'spectator' } },
  }));
  assert(spectatorWaitingHtml.includes('等待观战同步') && spectatorWaitingHtml.includes('退出观战'),
    '观战未同步时显示等待文案');

  const lobbySrcSpectator = readFileSync('src/components/Menu/OnlineLobby.jsx', 'utf8');
  assert(lobbySrcSpectator.includes('handleSpectate') && lobbySrcSpectator.includes('spectate: true')
    && lobbySrcSpectator.includes('spectatorMembers') && lobbySrcSpectator.includes('playerCountValue'),
  '大厅接入观战加入/分组/人数');
  const boardSrcSpectator = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardSrcSpectator.includes("online?.spectator || online?.role === 'spectator'")
    && boardSrcSpectator.includes('<SpectatorPanel') && boardSrcSpectator.includes('pendingAction && !isSpectator')
    && boardSrcSpectator.includes('{!isSpectator && ('),
  '对局观战只读/隐藏操作/观战栏');
  const appCssSpectator = readFileSync('src/App.css', 'utf8');
  assert(appCssSpectator.includes('.spectator-panel') && appCssSpectator.includes('.spectator-badge')
    && appCssSpectator.includes('.spectate-join-btn') && appCssSpectator.includes('.member-groups'),
  'App.css 观战栏/徽标/大厅入口/分组');
  assert(appCssSpectator.includes('@media (max-width: 760px)')
    && appCssSpectator.includes('spectator-panel') && appCssSpectator.includes('safe-area-inset-bottom'),
  '移动端观战栏适配');

  console.log('\n[51] 桌面宽屏 UI：大厅两栏 / 工坊 sticky / 音频背景 dashboard / 速玩居中');
  const desktopLobbyHtml = renderToString(React.createElement(OnlineLobby, { navigate: noop }));
  assert(desktopLobbyHtml.includes('online-layout') && desktopLobbyHtml.includes('online-main')
    && desktopLobbyHtml.includes('online-aside') && desktopLobbyHtml.includes('局域网联机')
    && desktopLobbyHtml.includes('观战说明') && desktopLobbyHtml.includes('中继服务器'),
  '大厅桌面两栏结构/右栏说明');
  const roomLobbyHtml = renderToString(React.createElement(OnlineLobby, {
    navigate: noop,
    initialOnline: {
      active: true, connected: true, isHost: true, roomCode: 'ABCD',
      seat: 0, spectator: false, role: 'player',
      members: [{ name: '房主', seat: 0 }],
    },
  }));
  assert(roomLobbyHtml.includes('online-invite-card') && roomLobbyHtml.includes('邀请手机加入')
    && roomLobbyHtml.includes('online-spectator-guide'), '房间态右栏邀请/观战说明');

  const quickHtml = renderToString(React.createElement(QuickPlay, { navigate: noop }));
  assert(quickHtml.includes('quick-foot') && quickHtml.includes('无需安装 App')
    && quickHtml.includes('扫码即开局'), '速玩页底部能力说明');
  const audioDashboardHtml = renderToString(React.createElement(AudioSettings, { onBack: noop }));
  assert(audioDashboardHtml.includes('audio-common') && audioDashboardHtml.includes('audio-bgm')
    && audioDashboardHtml.includes('audio-sfx'), '音频页 dashboard 分区 class');
  const bgDashboardHtml = renderToString(React.createElement(AppearanceSettings, { onBack: noop }));
  assert(bgDashboardHtml.includes('bg-shell') && bgDashboardHtml.includes('bg-preset-grid')
    && bgDashboardHtml.includes('自定义背景') && bgDashboardHtml.includes('显示效果'),
  '背景页宽屏 dashboard 内容');
  const editorDashboardHtml = renderToString(React.createElement(CharacterEditor, {
    navigate: noop, initialForm: { name: '关羽', hp: 4, maxHp: 4, equipSlots: 4, skillIds: [] },
  }));
  assert(editorDashboardHtml.includes('workshop-preview-stats')
    && editorDashboardHtml.includes('装备栏 <b>4</b>'), '工坊预览下方信息栏');
  renderPage('QuickPlay(速玩)', React.createElement(QuickPlay, { navigate: noop }),
    ['速玩', '手机单机速玩', '创建速玩房间', '扫码即开局']);

  const appCssDesktop = readFileSync('src/App.css', 'utf8');
  assert(appCssDesktop.includes('@media (min-width: 1024px)')
    && appCssDesktop.includes('.online-layout')
    && appCssDesktop.includes('grid-template-columns: minmax(0, 620px) minmax(280px, 1fr)')
    && appCssDesktop.includes('max-width: 1120px'), '桌面大厅两栏 CSS');
  assert(appCssDesktop.includes('.online-aside { display: none; }')
    && appCssDesktop.includes('[data-platform="desktop"] .online-aside')
    && appCssDesktop.includes('display: flex'), '手机隐藏/桌面显示右栏');
  assert(appCssDesktop.includes('@media (min-width: 1200px)')
    && appCssDesktop.includes('grid-template-columns: minmax(620px, 1fr) 380px')
    && appCssDesktop.includes('.workshop-preview-column { top: 16px; }')
    && appCssDesktop.includes('max-width: 1400px'), '工坊桌面 grid/sticky');
  assert(appCssDesktop.includes('grid-template-areas:')
    && appCssDesktop.includes('"left sfx"') && appCssDesktop.includes('grid-area: sfx;')
    && appCssDesktop.includes('.audio-left')
    && appCssDesktop.includes('repeat(3, minmax(0, 1fr))'), '音频 dashboard grid');
  assert(appCssDesktop.includes('.bg-section:nth-of-type(2)')
    && appCssDesktop.includes('repeat(4, minmax(0, 1fr))')
    && appCssDesktop.includes('width: min(1120px, 100%)'), '背景页两栏/4 场景 CSS');
  assert(appCssDesktop.includes('quick-foot') && appCssDesktop.includes('width: min(1040px, 100%)'),
    '速玩垂直居中/底部提示');
  assert(appCssDesktop.includes('@media (max-width: 760px)')
    && appCssDesktop.includes('.quick-play-bar'), '移动端规则保留');
  assert(appCssDesktop.includes('.workshop-preview-stats'), '工坊预览信息栏样式');

  console.log('\n[52] 局内聊天：聊天按钮 / ChatDock / 弹幕 / 本地屏蔽');
  assert(ICON_NAMES.includes('chat'), 'Icon 含 chat 图标');
  const chatIconHtml = renderToString(React.createElement(Icon, { name: 'chat', size: 16 }));
  assert(chatIconHtml.includes('ui-icon--chat'), 'chat 图标 SSR');
  assert(CHAT_MAX_LENGTH === 200, '聊天输入上限 200');
  const chatMessages = [
    { id: 'm1', senderId: 'p1', senderName: '甲', text: '你好', ts: 1760000000000 },
    { id: 'm2', senderId: 'p2', senderName: '乙', text: '观战消息', role: 'spectator', ts: 1760000100000 },
    { id: 'm3', senderId: 'me', senderName: '我', text: '自己消息', ts: 1760000200000 },
  ];
  assert(normalizeMutedIds(['p1', 'p1', 'p2']).join(',') === 'p1,p2'
    && normalizeMutedIds({ p1: true, p2: false }).join(',') === 'p1'
    && normalizeMutedIds(new Set(['p3'])).join(',') === 'p3', '屏蔽名单归一化');
  const filteredChat = filterChatMessages(chatMessages, { clientId: 'me', mutedIds: ['p1'] });
  assert(filteredChat.length === 2 && filteredChat.every(m => m.senderId !== 'p1')
    && filteredChat.some(m => m.senderId === 'me'), '屏蔽他人不影响自己');
  assert(normalizeChatMessages([{ text: '有效' }, { text: '' }, null, 'bad']).length === 1,
    '非法聊天消息忽略');
  const memStore = (() => {
    const map = new Map();
    return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
  })();
  assert(loadDanmakuEnabled(memStore) === true, '弹幕默认开启');
  saveDanmakuEnabled(false, memStore);
  assert(loadDanmakuEnabled(memStore) === false, '弹幕开关持久化关闭');
  saveDanmakuEnabled(true, memStore);
  assert(loadDanmakuEnabled(memStore) === true, '弹幕开关持久化开启');

  const chatDockHtml = renderToString(React.createElement(ChatDock, {
    open: true, roomCode: 'ROOM1', messages: chatMessages, clientId: 'me',
    mutedIds: [], danmakuEnabled: true, connected: true,
    onSend: noop, onMarkRead: noop, onToggleMute: noop, onToggleDanmaku: noop, onClose: noop,
  }));
  for (const text of ['chat-dock', '局内聊天', '房间 ROOM1', '甲', '你好', '观战',
    '自己消息', '屏蔽', '发送', '弹幕 开', 'chat-compose']) {
    assert(chatDockHtml.includes(text), `ChatDock 含「${text}」`);
  }
  assert(/maxlength="200"|maxLength="200"/.test(chatDockHtml), 'ChatDock 输入 maxLength=200');
  assert(!chatDockHtml.includes('已屏蔽'), '无屏蔽时不显示屏蔽名单');
  const mutedDockHtml = renderToString(React.createElement(ChatDock, {
    open: true, roomCode: 'ROOM1', messages: chatMessages, clientId: 'me',
    mutedIds: ['p1'], danmakuEnabled: false, connected: true,
    onSend: noop, onMarkRead: noop, onToggleMute: noop, onToggleDanmaku: noop, onClose: noop,
  }));
  assert(mutedDockHtml.includes('已屏蔽 1 人') && mutedDockHtml.includes('chat-muted-chip')
    && !mutedDockHtml.includes('你好') && mutedDockHtml.includes('观战消息')
    && mutedDockHtml.includes('自己消息') && mutedDockHtml.includes('弹幕 关'),
  '屏蔽后列表过滤他人/保留自己/名单 chip');
  const emptyChatHtml = renderToString(React.createElement(ChatDock, {
    open: true, messages: [], connected: false, onClose: noop,
  }));
  assert(emptyChatHtml.includes('chat-empty') && emptyChatHtml.includes('未连接'), '空态与未连接提示');
  assert(renderToString(React.createElement(ChatDock, { open: false })) === '', '关闭态不渲染 ChatDock');
  assert(renderToString(React.createElement(DanmakuLayer, {
    enabled: false, messages: chatMessages, clientId: 'me',
  })) === '', '弹幕关闭不渲染');

  const boardChatSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardChatSrc.includes('chat-toggle') && boardChatSrc.includes('chat-unread-badge')
    && boardChatSrc.includes('<ChatDock') && boardChatSrc.includes('<DanmakuLayer')
    && boardChatSrc.includes('online.active &&'), 'GameBoard 顶栏聊天入口/未读/面板/弹幕');
  assert(boardChatSrc.includes('s.chatMuted || s.online.chatMuted'),
    'GameBoard 读取顶层/online 两种屏蔽名单');
  const dockSrcChat = readFileSync('src/components/GameBoard/ChatDock.jsx', 'utf8');
  assert(dockSrcChat.includes('CHAT_MAX_LENGTH = 200') && dockSrcChat.includes('filterChatMessages')
    && dockSrcChat.includes('cgm_chat_danmaku') && dockSrcChat.includes("e.key === 'Enter'")
    && dockSrcChat.includes('onKeyDown'), '输入 200/Enter/屏蔽过滤/弹幕持久化');
  assert(dockSrcChat.includes('item.senderId || item.id || item.name'),
    '屏蔽名单兼容 {id,name} 对象，避免 [object Object]');
  const danmakuSrc = readFileSync('src/components/GameBoard/DanmakuLayer.jsx', 'utf8');
  assert(danmakuSrc.includes('seenRef') && danmakuSrc.includes('lane') && danmakuSrc.includes('slice(-12)'),
    '弹幕只飘新消息/泳道/最多 12 条');
  const appCssChat = readFileSync('src/App.css', 'utf8');
  assert(appCssChat.includes('.chat-dock') && appCssChat.includes('width: 340px')
    && appCssChat.includes('.chat-unread-badge') && appCssChat.includes('.chat-messages'),
  '聊天面板/未读角标样式');
  assert(appCssChat.includes('@media (max-width: 760px)')
    && appCssChat.includes('max-height: 45vh') && appCssChat.includes('safe-area-inset-bottom'),
  '手机底部抽屉/safe-area');
  assert(appCssChat.includes('.danmaku-layer') && appCssChat.includes('pointer-events: none')
    && appCssChat.includes('@keyframes danmakuDrift')
    && appCssChat.includes('var(--lane') && appCssChat.includes('--lane'),
  '弹幕层 pointer-events/泳道/右→左 keyframes');
  assert(appCssChat.includes('prefers-reduced-motion') && appCssChat.includes('.danmaku-layer { display: none'),
    'reduced-motion 关闭弹幕');

  console.log('\n[53] 局内设置按钮 + GameSettingsPanel（音效/对局/显示）');
  const settingsStore = (() => {
    const map = new Map([['cgm_game_config', JSON.stringify({ playerCount: 5, aiDelay: 1200, teamMode: 'ffa' })]]);
    return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
  })();
  assert(GAME_SETTINGS_AI_MIN === 700 && GAME_SETTINGS_AI_MAX === 1800 && GAME_SETTINGS_AI_DEFAULT === 900,
    'AI 延迟范围 700~1800 / 默认 900');
  assert(readGameAiDelay(settingsStore) === 1200, '读取 cgm_game_config.aiDelay');
  saveGameAiDelay(1800, settingsStore);
  assert(readGameAiDelay(settingsStore) === 1800, '写回 aiDelay');
  const preservedGameConfig = JSON.parse(settingsStore.getItem('cgm_game_config'));
  assert(preservedGameConfig.playerCount === 5 && preservedGameConfig.teamMode === 'ffa'
    && preservedGameConfig.aiDelay === 1800, '写回 aiDelay 不清空其他配置');
  saveGameAiDelay(9999, settingsStore);
  assert(readGameAiDelay(settingsStore) === GAME_SETTINGS_AI_MAX, 'AI 延迟上限 clamp');
  saveGameAiDelay(10, settingsStore);
  assert(readGameAiDelay(settingsStore) === GAME_SETTINGS_AI_MIN, 'AI 延迟下限 clamp');

  const fakeAudio = {
    getConfig: () => ({ enabled: false, master: 0.5, bgm: 0.25, sfx: 0.6 }),
    setEnabled: noop,
    setVolume: noop,
  };
  const settingsLayout = { showFloats: true, showDistance: false, showBanner: true };
  const gameSettingsHtml = renderToString(React.createElement(GameSettingsPanel, {
    open: true,
    onClose: noop,
    layout: settingsLayout,
    onLayoutChange: noop,
    onOpenLayout: noop,
    audioManager: fakeAudio,
    spectator: false,
    roomCode: 'ROOM9',
    modeLabel: '自由混战',
    round: 3,
    phaseLabel: '出牌阶段',
  }));
  for (const text of ['game-settings-panel', '设置', '音效', '启用游戏音频',
    '主音量', '背景音乐', '音效设置已即时生效', 'AI 思考延迟', '700', '1800',
    '伤害飘字', '距离提示', '回合开始横幅', '更多布局设置', '关闭', '房间',
    'ROOM9', '阶段', '出牌阶段']) {
    assert(gameSettingsHtml.includes(text), `GameSettingsPanel 含「${text}」`);
  }
  assert((gameSettingsHtml.match(/type="range"/g) || []).length >= 4, '音效 3 滑杆 + AI 延迟滑杆');
  const spectatorSettingsHtml = renderToString(React.createElement(GameSettingsPanel, {
    open: true, onClose: noop, layout: settingsLayout, audioManager: fakeAudio, spectator: true,
  }));
  assert(!spectatorSettingsHtml.includes('AI 思考延迟') && spectatorSettingsHtml.includes('身份')
    && spectatorSettingsHtml.includes('主音量') && spectatorSettingsHtml.includes('伤害飘字'),
  '观战者隐藏 AI 延迟，保留音效/显示');
  assert(renderToString(React.createElement(GameSettingsPanel, { open: false })) === '',
    '关闭态不渲染设置面板');

  const boardSettingsSrc = readFileSync('src/components/GameBoard/GameSettingsPanel.jsx', 'utf8');
  assert(boardSettingsSrc.includes('setEnabled') && boardSettingsSrc.includes('setVolume')
    && boardSettingsSrc.includes('saveGameAiDelay') && boardSettingsSrc.includes('onLayoutChange')
    && boardSettingsSrc.includes('onOpenLayout') && boardSettingsSrc.includes('Escape'),
  '音效即时生效/AI延迟持久化/布局回调/Esc');
  const boardGameSrcSettings = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardGameSrcSettings.includes('GameSettingsPanel') && boardGameSrcSettings.includes('showGameSettings')
    && boardGameSrcSettings.includes('game-settings-trigger') && boardGameSrcSettings.includes("name=\"settings\"")
    && boardGameSrcSettings.includes('onLayoutChange={applyLayoutChange}'),
  'GameBoard 顶栏设置按钮/state/面板接入');
  const appCssSettings = readFileSync('src/App.css', 'utf8');
  assert(appCssSettings.includes('.game-settings-overlay') && appCssSettings.includes('z-index: 1300')
    && appCssSettings.includes('.game-settings-panel') && appCssSettings.includes('width: min(540px, 100%)'),
  '设置面板桌面 540px/遮罩 z-index');
  assert(appCssSettings.includes('@media (max-width: 760px)')
    && appCssSettings.includes('max-height: 80vh') && appCssSettings.includes('safe-area-inset-bottom')
    && appCssSettings.includes('min-height: 44px'), '手机底部 80vh/safe-area/44px');

  console.log('\n[54] 战局指令台 Ctrl+K / 战局脉搏');
  const commandFixtures = [
    { id: 'recommend', label: '推荐出牌', keywords: ['tuijian', 'tj'], icon: 'sparkle', run: noop },
    { id: 'endPlay', label: '结束出牌', keywords: ['jieshu', 'js'], icon: 'check', disabled: true, run: noop },
    { id: 'log', label: '查看日志', keywords: ['rizhi', 'rz'], shortcut: 'L', run: noop },
  ];
  assert(filterCommands(commandFixtures, 'tj').length === 1
    && filterCommands(commandFixtures, '结束')[0].id === 'endPlay'
    && filterCommands(commandFixtures, 'rz')[0].id === 'log'
    && filterCommands(commandFixtures, '').length === 3, '指令中文/拼音关键词过滤');
  const commandPaletteHtml = renderToString(React.createElement(CommandPalette, {
    open: true, commands: commandFixtures, roomCode: 'ROOM7', onClose: noop,
  }));
  for (const text of ['command-palette', '搜索指令', '推荐出牌', '结束出牌', '查看日志',
    '不可用', '房间 ROOM7', '↑↓', '关闭']) {
    assert(commandPaletteHtml.includes(text), `指令台含「${text}」`);
  }
  assert(commandPaletteHtml.includes('command-item active')
    && commandPaletteHtml.includes('disabled'), '指令台首项高亮/禁用态');
  const emptyCommandHtml = renderToString(React.createElement(CommandPalette, {
    open: true, commands: [], onClose: noop,
  }));
  assert(emptyCommandHtml.includes('没有匹配的指令'), '指令台空结果提示');
  assert(renderToString(React.createElement(CommandPalette, { open: false })) === '',
    '指令台关闭态不渲染');

  const pulseSelf = {
    id: 's1', name: '你', hp: 4, maxHp: 4, status: 'alive',
    handCards: [{ name: '杀' }, { name: '闪' }],
  };
  const pulseEnemy = { id: 'e1', name: '敌将', hp: 1, maxHp: 4, status: 'alive', handCards: [] };
  const pulseEnemyFull = { id: 'e2', name: '满血敌', hp: 4, maxHp: 4, status: 'alive', handCards: [] };
  const pulseBase = {
    selfPlayer: pulseSelf,
    players: [pulseSelf, pulseEnemyFull],
    selectedTarget: null,
    currentPlayer: pulseSelf,
    pendingAction: null,
    currentPhase: 'play',
    phaseLabel: '出牌阶段',
    spectator: false,
  };
  const pulseKill = buildTacticalPulse({ ...pulseBase, selectedTarget: pulseEnemy });
  assert(pulseKill.hint.startsWith('斩杀窗口') && pulseKill.tone === 'kill'
    && pulseKill.chips.length === 4, '脉搏斩杀窗口');
  const pulseKillOpportunity = buildTacticalPulse({
    ...pulseBase, players: [pulseSelf, pulseEnemy],
  });
  assert(pulseKillOpportunity.hint.startsWith('斩杀机会'), '脉搏斩杀机会');
  const pulseRecover = buildTacticalPulse({
    ...pulseBase,
    selfPlayer: { ...pulseSelf, hp: 2, handCards: [{ name: '桃' }] },
  });
  assert(pulseRecover.hint.startsWith('回复窗口') && pulseRecover.tone === 'recover', '脉搏回复窗口');
  const pulseOverflow = buildTacticalPulse({
    ...pulseBase,
    selfPlayer: { ...pulseSelf, maxHp: 3, handCards: [{ name: '闪' }, { name: '闪' }, { name: '闪' }, { name: '闪' }, { name: '闪' }] },
    players: [{ ...pulseSelf, maxHp: 3 }, pulseEnemyFull],
  });
  assert(pulseOverflow.hint.includes('手牌溢出') && pulseOverflow.hint.includes('2'),
    '脉搏手牌溢出');
  const pulseNoSha = buildTacticalPulse({
    ...pulseBase,
    selfPlayer: { ...pulseSelf, handCards: [{ name: '闪' }] },
  });
  assert(pulseNoSha.hint.startsWith('无杀可用') && pulseNoSha.tone === 'warn', '脉搏无杀提示');
  const pulseObserve = buildTacticalPulse({
    ...pulseBase,
    currentPlayer: pulseEnemyFull,
    selectedTarget: null,
  });
  assert(pulseObserve.hint.startsWith('观察中'), '脉搏观察提示');
  const pulseCalm = buildTacticalPulse({ ...pulseBase, selfPlayer: { ...pulseSelf, handCards: [{ name: '杀' }, { name: '闪' }] } });
  assert(pulseCalm.hint.startsWith('局势平稳') && pulseCalm.tone === 'calm', '脉搏默认提示');
  const pulseSpectator = buildTacticalPulse({
    ...pulseBase, spectator: true, selfPlayer: null,
    players: [{ ...pulseSelf, handCards: [] }, { ...pulseEnemyFull, handCards: [] }],
  });
  assert(pulseSpectator.hint.startsWith('观战中') && pulseSpectator.tone === 'observe'
    && pulseSpectator.chips.some(c => c.label.includes('观战'))
    && pulseSpectator.chips.every(c => !c.label.startsWith('手牌')), '观战脉搏不泄露手牌');
  const pulseHtml = renderToString(React.createElement(TacticalPulse, {
    selfPlayer: pulseSelf,
    players: [pulseSelf, pulseEnemy],
    selectedTarget: pulseEnemy,
    currentPlayer: pulseSelf,
    currentPhase: 'play',
    phaseLabel: '出牌阶段',
  }));
  assert((pulseHtml.match(/class="pulse-chip"/g) || []).length === 4
    && pulseHtml.includes('战局脉搏') && pulseHtml.includes('斩杀窗口')
    && pulseHtml.includes('pulse-dot'), '脉搏 SSR 4 chips/提示/脉冲点');
  const spectatorPulseHtml = renderToString(React.createElement(TacticalPulse, {
    spectator: true, players: [pulseSelf, pulseEnemyFull],
    currentPlayer: pulseSelf,
  }));
  assert(spectatorPulseHtml.includes('观战中：观察双方手牌数量')
    && !spectatorPulseHtml.includes('手牌 2/4'), '观战脉搏 SSR 不显示手牌');

  const boardCommandSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardCommandSrc.includes('showCommandPalette') && boardCommandSrc.includes('<CommandPalette')
    && boardCommandSrc.includes('<TacticalPulse') && boardCommandSrc.includes('command-trigger')
    && boardCommandSrc.includes("event.key === 'k'") && boardCommandSrc.includes("event.key === '/'")
    && boardCommandSrc.includes('gameCommands') && boardCommandSrc.includes('arrangeHand')
    && boardCommandSrc.includes("type: 'endPlay'"), 'GameBoard Ctrl+K/按钮/指令/脉搏接入');
  const commandSrc = readFileSync('src/components/GameBoard/CommandPalette.jsx', 'utf8');
  assert(commandSrc.includes('filterCommands') && commandSrc.includes('ArrowDown')
    && commandSrc.includes('ArrowUp') && commandSrc.includes('Enter')
    && commandSrc.includes('Escape'), '指令台键盘/过滤');
  const pulseSrc = readFileSync('src/components/GameBoard/TacticalPulse.jsx', 'utf8');
  assert(pulseSrc.includes('buildTacticalPulse') && pulseSrc.includes('斩杀窗口')
    && pulseSrc.includes('手牌溢出') && pulseSrc.includes('观战中'), '脉搏优先级规则');
  const appCssCommand = readFileSync('src/App.css', 'utf8');
  assert(appCssCommand.includes('.command-palette-overlay') && appCssCommand.includes('z-index: 1500')
    && appCssCommand.includes('width: min(560px, 100%)') && appCssCommand.includes('.command-item.active'),
  '指令台桌面 560/z1500/高亮');
  assert(appCssCommand.includes('.tactical-pulse') && appCssCommand.includes('.pulse-chip')
    && appCssCommand.includes('@keyframes pulseDot') && appCssCommand.includes('max-width: 900px'),
  '脉搏 chips/动画/900 隐藏');
  assert(appCssCommand.includes('@media (max-width: 760px)')
    && appCssCommand.includes('max-height: 82vh') && appCssCommand.includes('min-height: 44px'),
  '指令台手机底部/44px');
  assert(appCssCommand.includes('prefers-reduced-motion')
    && appCssCommand.includes('.pulse-dot { animation: none'), '脉搏 reduced-motion');
  const appJsxTap = readFileSync('src/App.jsx', 'utf8');
  assert(appJsxTap.includes('tap-spark') && appJsxTap.includes('.game-card')
    && appJsxTap.includes('.player-area') && appJsxTap.includes('CLICKABLE'),
  '任意可点卡牌/武将/装备/菜单都有点击脉冲');
  assert(appCssCommand.includes('.tap-spark') && appCssCommand.includes('@keyframes tapSpark')
    && appCssCommand.includes('transition: transform .55s cubic-bezier')
    && appCssCommand.includes('.btn.icon-picked { animation: none !important; }'),
  '点击脉冲合成层 + 金属反光改 transform');
  const boardHandCssSrc = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
  assert(boardHandCssSrc.includes('flex-wrap: nowrap') && boardHandCssSrc.includes('justify-content: safe center')
    && boardHandCssSrc.includes('overflow-x: auto'),
  '桌面手牌不换行、安全居中、超宽可横向滚动');
  const menuWidthSrc = readFileSync('src/components/Menu/MainMenu.jsx', 'utf8');
  assert(menuWidthSrc.includes('max-width: 1680px') && menuWidthSrc.includes('.mm-head,')
    && menuWidthSrc.includes('.mm-deck,'), '超宽屏主菜单内容封顶 1680px 居中');

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exitCode = 1;
});
