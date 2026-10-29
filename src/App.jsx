import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import MainMenu from './components/Menu/MainMenu';
// 对局页体积大（引擎+棋盘），同样按需加载；菜单挂载后空闲时预热
const GameBoard = lazy(() => import('./components/GameBoard/GameBoard'));
// 次要页面按需加载：编辑器/大厅/设置不进首包（ArtStudio/VoiceStudio 随编辑器一起拆出）
const CharacterEditor = lazy(() => import('./components/Editor/CharacterEditor'));
const SkillEditor = lazy(() => import('./components/Editor/SkillEditor'));
const CodePreview = lazy(() => import('./components/Editor/CodePreview'));
const Settings = lazy(() => import('./components/Menu/Settings'));
const OnlineLobby = lazy(() => import('./components/Menu/OnlineLobby'));
const AudioSettings = lazy(() => import('./components/Menu/AudioSettings'));
const AppearanceSettings = lazy(() => import('./components/Menu/AppearanceSettings'));
const QuickPlay = lazy(() => import('./components/Menu/QuickPlay.jsx'));
import FxLayer from './components/GameBoard/FxOverlay';
import {
  parseFxPreview,
  buildPreviewFx,
  enqueueFx,
  shiftFx,
} from './components/GameBoard/effectFx';
import SceneBackground from './components/GameBoard/SceneBackground';
import GameDialog from './components/ui/GameDialog';
import { audio } from './audio/audioManager';
import { applySavedFont } from './appearance/fontManager';
import { loadThemeStudio, applyThemeStudio } from './utils/themeStudio';
import { LAYOUT_STORAGE_KEY, applyPreset, saveLayout } from './components/GameBoard/layoutConfig';
import {
  parseLaunchParams,
  buildQuickPlayConfigs,
  pickQuickPlayLayout,
  QUICK_PLAY_TEAM_MODE,
} from './components/Menu/quickPlay.js';
import useGameStore from './store/gameStore';
import { usePlatform, isTouchInput } from './utils/mobile';

applySavedFont();
// 主题工坊：启动即恢复本机主题（关闭时仅写 off，不覆盖原有三套 theme）
applyThemeStudio(loadThemeStudio());

const PAGES = {
  MENU: 'menu',
  GAME: 'game',
  EDITOR: 'editor',
  SKILL_EDITOR: 'skill_editor',
  CODE_PREVIEW: 'code_preview',
  SETTINGS: 'settings',
  ONLINE: 'online',
  AUDIO: 'audio',
  APPEARANCE: 'appearance',
  QUICK: 'quick',
};

export default function App() {
  // 扫码启动参数：?room= 直接进联机大厅；?quick=1 直接进对局
  const launch = typeof window !== 'undefined'
    ? parseLaunchParams(window.location.search)
    : { mode: 'menu', quick: false, room: null };
  const initialPage = launch.mode === 'room'
    ? PAGES.ONLINE
    : (launch.mode === 'quick' ? PAGES.GAME : PAGES.MENU);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [editorContext, setEditorContext] = useState(null);
  const [quickNotice, setQuickNotice] = useState(null);
  const [previewFxQueue, setPreviewFxQueue] = useState([]);
  const onlineActive = useGameStore(s => s.online.active);
  const platform = usePlatform();
  const inputMode = typeof window !== 'undefined' && isTouchInput() ? 'touch' : 'mouse';
  const launchHandled = useRef(false);
  const fxHandled = useRef(false);

  const navigate = (page, context = null) => {
    setCurrentPage(page);
    setEditorContext(context);
  };

  // 启动参数只处理一次：?quick=1 自动开局并清 query；?room= 保留 query 供大厅自动加入
  useEffect(() => {
    if (typeof window === 'undefined' || launchHandled.current) return undefined;
    launchHandled.current = true;
    const params = parseLaunchParams(window.location.search);

    if (params.mode === 'room') {
      setCurrentPage(PAGES.ONLINE);
      return undefined;
    }
    if (params.mode !== 'quick') return undefined;

    // 手机窄屏且本地没有布局设置时自动套紧凑布局（不覆盖已存设置）
    try {
      const hasStoredLayout = !!window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      const preset = pickQuickPlayLayout({ width: window.innerWidth, hasStoredLayout });
      if (preset) saveLayout(applyPreset(preset));
    } catch { /* 隐私模式 / 存储不可用 */ }

    // 清掉 query，避免刷新重复开局
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    } catch { /* ignore */ }

    setCurrentPage(PAGES.GAME);
    setQuickNotice('速玩开局');
    useGameStore.getState()
      .startGame(buildQuickPlayConfigs(), null, { teamMode: QUICK_PLAY_TEAM_MODE })
      .catch(() => {});
    return undefined;
  }, []);

  // 速玩开局轻提示自动消失（独立 effect，兼容 StrictMode）
  useEffect(() => {
    if (!quickNotice) return undefined;
    const timer = setTimeout(() => setQuickNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [quickNotice]);

  // 演出特效预览：?fx=execution|dying|judge|heal|thunder（可带 name/source）
  useEffect(() => {
    if (typeof window === 'undefined' || fxHandled.current) return undefined;
    fxHandled.current = true;
    const preview = parseFxPreview(window.location.search);
    if (!preview) return undefined;
    const fx = buildPreviewFx(preview);
    if (fx) setPreviewFxQueue(q => enqueueFx(q, fx));
    try {
      const url = new URL(window.location.href);
      ['fx', 'name', 'source'].forEach(key => url.searchParams.delete(key));
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* ignore */ }
    return undefined;
  }, []);

  // 联机客户端收到"开始"后自动进入对局
  useEffect(() => {
    if (onlineActive) {
      setCurrentPage(PAGES.GAME);
    }
  }, [onlineActive]);

  // 背景音乐场景：对局用对局 BGM，其余页面用主菜单 BGM
  useEffect(() => {
    audio.setScene(currentPage === PAGES.GAME ? 'game' : 'menu');
  }, [currentPage]);

  // 空闲时预热对局分包：玩家点"开始对局"时无需再等下载
  useEffect(() => {
    const warm = () => { import('./components/GameBoard/GameBoard').catch(() => {}); };
    if (typeof window === 'undefined') return undefined;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, []);

  // 全局点击反馈：按钮水波纹 + 图标按压；任意可点卡牌/武将/装备/菜单也有一次轻量金色脉冲
  useEffect(() => {
    const CLICKABLE = [
      'button', 'a', '[role="button"]',
      '.btn', '.icon-btn', '.game-card', '.hand-card-wrap', '.player-area',
      '.equip-tag', '.log-strip', '.mm-tile', '.menu-tile', '.chat-mute-btn',
      '.chat-muted-chip', '.chat-dock-close', '.layout-trigger',
    ].join(', ');
    const onPointerDown = (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      // 输入控件保持原生反馈，不叠加游戏点击特效
      if (target.closest('input, textarea, select')) return;
      const hit = target.closest(CLICKABLE);
      if (!hit || hit.disabled || hit.getAttribute('aria-disabled') === 'true') return;

      // 任意可点区域：固定定位的金色脉冲，只动 transform/opacity
      try {
        const spark = document.createElement('span');
        spark.className = 'tap-spark';
        spark.style.left = `${e.clientX}px`;
        spark.style.top = `${e.clientY}px`;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 460);
      } catch { /* ignore */ }

      const btn = target.closest('button, .btn');
      if (!btn || btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const size = Math.max(rect.width, rect.height) * 1.25;
      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      // 选中反馈：图标旋转 + 金色闪耀；所有可点按钮同时进入按压态（不依赖 hover）
      btn.classList.remove('icon-picked');
      void btn.offsetWidth;
      btn.classList.add('icon-picked', 'is-pressing');
      clearTimeout(btn._iconPickedTimer);
      btn._iconPickedTimer = setTimeout(() => btn.classList.remove('icon-picked'), 560);
    };
    const release = () => {
      document.querySelectorAll('.is-pressing').forEach(el => {
        clearTimeout(el._pressTimer);
        el._pressTimer = setTimeout(() => el.classList.remove('is-pressing'), 40);
      });
    };
    const onKeyActivate = (e) => {
      if (e.detail !== 0) return;
      const btn = e.target?.closest?.('button, .btn, .icon-btn');
      if (!btn || btn.disabled) return;
      btn.classList.remove('icon-picked', 'is-pressing');
      void btn.offsetWidth;
      btn.classList.add('icon-picked', 'is-pressing');
      clearTimeout(btn._iconPickedTimer);
      btn._iconPickedTimer = setTimeout(() => btn.classList.remove('icon-picked', 'is-pressing'), 560);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    document.addEventListener('click', onKeyActivate);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      document.removeEventListener('click', onKeyActivate);
    };
  }, []);

  let page = null;
  if (currentPage === PAGES.MENU) page = <MainMenu navigate={navigate} />;
  else if (currentPage === PAGES.GAME) page = <GameBoard navigate={navigate} />;
  else if (currentPage === PAGES.EDITOR) page = <CharacterEditor navigate={navigate} context={editorContext} />;
  else if (currentPage === PAGES.SKILL_EDITOR) page = <SkillEditor navigate={navigate} context={editorContext} />;
  else if (currentPage === PAGES.CODE_PREVIEW) page = <CodePreview navigate={navigate} context={editorContext} />;
  else if (currentPage === PAGES.SETTINGS) page = <Settings navigate={navigate} />;
  else if (currentPage === PAGES.ONLINE) page = <OnlineLobby navigate={navigate} />;
  else if (currentPage === PAGES.AUDIO) page = <AudioSettings onBack={() => navigate(PAGES.MENU)} />;
  else if (currentPage === PAGES.APPEARANCE) page = <AppearanceSettings onBack={() => navigate(PAGES.MENU)} />;
  else if (currentPage === PAGES.QUICK) page = <QuickPlay navigate={navigate} />;

  return (
    <div className="app" data-platform={platform} data-input={inputMode}>
      <SceneBackground variant={currentPage === PAGES.GAME ? 'game' : 'menu'} />
      <div className="page-view page-transition" key={currentPage}>
        <Suspense fallback={<div className="page-lazy-loading" aria-live="polite">加载中…</div>}>
          {page}
        </Suspense>
      </div>
      <FxLayer queue={previewFxQueue} onShift={() => setPreviewFxQueue(q => shiftFx(q))} />
      <GameDialog />
      {quickNotice && (
        <div className="quick-notice" role="status">
          <span className="quick-notice-dot" aria-hidden="true" />
          {quickNotice}
        </div>
      )}
    </div>
  );
}
