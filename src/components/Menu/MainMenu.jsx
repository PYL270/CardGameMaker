import React, { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import Icon from '../ui/Icon';
import MobileNotice from './MobileNotice';

/**
 * 主菜单 · 赌桌布阵式编排
 * ------------------------------------------------------------------
 * 设计要点（与旧版 460px 居中窄栏完全不同）：
 * 1. 满屏舞台，不再是一个“手机 App 卡片居中”的长条
 * 2. 三条横向视觉带（对战 / 创作 / 系统），每带一个书法编号 壹 贰 叁
 * 3. 首带用一张跨 6 栏的大牌「开始游戏」，其余功能降为同尺寸小牌
 * 4. 背景是极慢旋转的罗盘星纹，呼应图标里的金环与双剑
 */
export default function MainMenu({ navigate }) {
  const initGame = useGameStore(s => s.initGame);

  const handleStart = () => {
    initGame();
    navigate('game');
  };

  // Enter 直接开局：桌面端该有的手感
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (document.querySelector('.overlay, .result-overlay, .layout-settings-overlay')) return;
      e.preventDefault();
      initGame();
      navigate('game');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [initGame, navigate]);

  const createItems = [
    { icon: 'editor', title: '武将编辑器', desc: '技能 · 属性 · 立绘', go: () => navigate('editor') },
    { icon: 'book', title: '技能编辑器', desc: '触发时机 · 效果脚本', go: () => navigate('skill_editor') },
    {
      icon: 'palette',
      title: 'AI 立绘',
      desc: '免费生成武将立绘',
      go: () => navigate('editor', { focus: 'art' }),
      hint: 'Stable Horde',
    },
    { icon: 'code', title: '代码生成区', desc: '查看 / 导出武将代码', go: () => navigate('code_preview') },
  ];

  const systemItems = [
    { icon: 'settings', title: '设置', desc: '对局 · 音效 · 安装包', go: () => navigate('settings') },
    { icon: 'music', title: '音频设置', desc: '音乐 · 音效 · 语音', go: () => navigate('audio') },
    { icon: 'image', title: '背景设置', desc: '场景 · 主题 · 字体', go: () => navigate('appearance') },
  ];

  return (
    <div className="mm-stage">
      {/* 背景：罗盘星纹 + 中心柔光 */}
      <div className="mm-aura" aria-hidden="true" />
      <div className="mm-rose" aria-hidden="true">
        <svg viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="198" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 10" />
          <circle cx="200" cy="200" r="118" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="200" cy="200" r="52" stroke="currentColor" strokeWidth="0.5" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * Math.PI * 2) / 24;
            const r1 = i % 3 === 0 ? 118 : 140;
            return (
              <line
                key={i}
                x1={200 + Math.cos(a) * r1}
                y1={200 + Math.sin(a) * r1}
                x2={200 + Math.cos(a) * 160}
                y2={200 + Math.sin(a) * 160}
                stroke="currentColor"
                strokeWidth={i % 3 === 0 ? 0.9 : 0.4}
              />
            );
          })}
          <path
            d="M200 62 L214 186 L338 200 L214 214 L200 338 L186 214 L62 200 L186 186 Z"
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.8"
          />
          <circle cx="200" cy="200" r="4" fill="currentColor" />
        </svg>
      </div>

      <header className="mm-head">
        <div className="mm-brand">
          <div className="mm-crest" aria-hidden="true">
            <span className="crest-orbit o1" />
            <span className="crest-orbit o2" />
            <span className="crest-shine" />
            <svg className="crest-swords" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="mmCrestGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8ecc9" />
                  <stop offset="45%" stopColor="#d6b96e" />
                  <stop offset="100%" stopColor="#9c7c35" />
                </linearGradient>
              </defs>
              <g className="blade blade-a">
                <path d="M31 89 L73 47 L83 37 L89 31 L84 43 L74 53 L42 84 Z" fill="url(#mmCrestGold)" />
                <path d="M29 84 L40 95" stroke="url(#mmCrestGold)" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g className="blade blade-b">
                <path d="M89 89 L47 47 L37 37 L31 31 L36 43 L46 53 L78 84 Z" fill="url(#mmCrestGold)" />
                <path d="M91 84 L80 95" stroke="url(#mmCrestGold)" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <circle className="crest-core" cx="60" cy="60" r="7.5" fill="none" stroke="#f0d894" strokeWidth="1.3" />
              <circle className="crest-core-dot" cx="60" cy="60" r="2.3" fill="#f0d894" />
            </svg>
            <span className="crest-spark s1" />
            <span className="crest-spark s2" />
            <span className="crest-spark s3" />
            <span className="crest-spark s4" />
          </div>

          <div className="mm-brand-text">
            <h1>CardGameMaker</h1>
            <p className="mm-brand-sub">
              <span>卡牌游戏制作器</span>
              <i aria-hidden="true" />
              <span>自定义武将 · AI 辅助</span>
            </p>
          </div>
        </div>

        <div className="mm-head-right">
          <span className="mm-badge">
            <i className="mm-live" aria-hidden="true" />
            本地对局
          </span>
          <span className="mm-version">v1.0.0</span>
        </div>
      </header>

      <MobileNotice compact />

      <main className="mm-deck">
        {/* ── 壹 · 对战 ─────────────────────────────────────── */}
        <section className="mm-band" aria-label="对战">
          <div className="mm-band-head">
            <span className="mm-index">壹</span>
            <span className="mm-band-label">对战</span>
            <span className="mm-band-hint">PLAY</span>
            <i className="mm-rule" />
          </div>

          <div className="mm-grid">
            <button className="mm-hero" onClick={handleStart} title="开始单机对局（Enter）">
              <span className="mm-hero-sheen" aria-hidden="true" />
              <span className="mm-hero-icon" aria-hidden="true">
                <Icon name="sword" size={32} />
              </span>
              <span className="mm-hero-text">
                <span className="mm-hero-title">开始游戏</span>
                <span className="mm-hero-desc">单机对局 · 2–6 人 · 座位与牌序可复现</span>
              </span>
              <span className="mm-hero-key" aria-hidden="true">ENTER</span>
            </button>

            <button className="mm-tile mm-span-3" onClick={() => navigate('online')}>
              <span className="mm-tile-icon"><Icon name="network" size={19} /></span>
              <span className="mm-tile-text">
                <b>联机对战</b>
                <em>局域网 · 房间号 / 扫码加入</em>
              </span>
              <span className="mm-tile-go"><Icon name="chevron-right" size={14} /></span>
            </button>

            <button className="mm-tile mm-span-3" onClick={() => navigate('quick')} title="速玩：手机扫码即玩，无需安装 App">
              <span className="mm-tile-icon"><Icon name="sparkle" size={19} /></span>
              <span className="mm-tile-text">
                <b>速玩</b>
                <em>手机扫码即开 · 无需安装</em>
              </span>
              <span className="mm-tile-go"><Icon name="chevron-right" size={14} /></span>
            </button>
          </div>
        </section>

        {/* ── 贰 · 创作 ─────────────────────────────────────── */}
        <section className="mm-band" aria-label="创作">
          <div className="mm-band-head">
            <span className="mm-index">贰</span>
            <span className="mm-band-label">创作</span>
            <span className="mm-band-hint">CREATE</span>
            <i className="mm-rule" />
          </div>

          <div className="mm-grid">
            {createItems.map(item => (
              <button key={item.title} className="mm-tile mm-span-3" onClick={item.go}>
                <span className="mm-tile-icon"><Icon name={item.icon} size={19} /></span>
                <span className="mm-tile-text">
                  <b>{item.title}</b>
                  <em>{item.desc}</em>
                </span>
                <span className="mm-tile-go"><Icon name="chevron-right" size={14} /></span>
              </button>
            ))}
          </div>
        </section>

        {/* ── 叁 · 系统 ─────────────────────────────────────── */}
        <section className="mm-band" aria-label="系统">
          <div className="mm-band-head">
            <span className="mm-index">叁</span>
            <span className="mm-band-label">系统</span>
            <span className="mm-band-hint">SYSTEM</span>
            <i className="mm-rule" />
          </div>

          <div className="mm-grid">
            {systemItems.map(item => (
              <button key={item.title} className="mm-tile mm-span-3" onClick={item.go}>
                <span className="mm-tile-icon"><Icon name={item.icon} size={19} /></span>
                <span className="mm-tile-text">
                  <b>{item.title}</b>
                  <em>{item.desc}</em>
                </span>
                <span className="mm-tile-go"><Icon name="chevron-right" size={14} /></span>
              </button>
            ))}

            <div className="mm-plate mm-span-3" aria-hidden="true">
              <span className="mm-plate-mark">墨玉鎏金</span>
              <span className="mm-plate-sub">自定武将 · 自定技能 · 自定牌局</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="mm-foot">
        <span><kbd>Enter</kbd> 快速开局</span>
        <span className="mm-foot-dot" />
        <span>存档在本地，换机请先在设置里导出</span>
        <span className="mm-foot-dot" />
        <span className="mm-foot-mono">React + Vite</span>
      </footer>

      <style>{`
        /* ===== 舞台 ===== */
        .mm-stage {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden auto;
          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2vh, 24px);
          padding: clamp(16px, 2.6vh, 34px) clamp(18px, 3.4vw, 58px) clamp(14px, 2.2vh, 26px);
          isolation: isolate;
          background:
            radial-gradient(70% 46% at 50% -6%, rgba(214, 185, 110, 0.055), transparent 72%),
            radial-gradient(46% 44% at 102% 108%, rgba(104, 76, 40, 0.12), transparent 72%);
        }
        .mm-aura {
          position: absolute;
          inset: -10% -10% auto -10%;
          height: 70%;
          z-index: 0;
          pointer-events: none;
          background: radial-gradient(closest-side, rgba(240, 216, 148, 0.07), transparent 72%);
          animation: mmAura 11s ease-in-out infinite alternate;
        }
        @keyframes mmAura {
          from { opacity: .55; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1;   transform: translateY(6px) scale(1.04); }
        }
        .mm-rose {
          position: absolute;
          top: 48%;
          left: 50%;
          width: min(86vh, 900px);
          height: min(86vh, 900px);
          margin: calc(min(86vh, 900px) / -2) 0 0 calc(min(86vh, 900px) / -2);
          z-index: 0;
          pointer-events: none;
          color: #d6b96e;
          opacity: 0.09;
          animation: mmSpin 180s linear infinite;
        }
        .mm-rose svg { width: 100%; height: 100%; display: block; }
        @keyframes mmSpin { to { transform: rotate(360deg); } }

        .mm-head,
        .mm-deck,
        .mm-foot,
        .mobile-capability-notice {
          position: relative;
          z-index: 1;
        }

        /* ===== 抬头 ===== */
        .mm-head,
        .mm-deck,
        .mm-foot {
          width: 100%;
          max-width: 1680px;
          margin-left: auto;
          margin-right: auto;
        }
        .mm-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: clamp(12px, 1.6vh, 18px);
          flex: 0 0 auto;
        }
        .mm-head::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg,
            transparent, rgba(214, 185, 110, 0.28) 10%,
            rgba(214, 185, 110, 0.28) 90%, transparent);
        }
        .mm-brand { display: flex; align-items: center; gap: 16px; min-width: 0; }

        .mm-crest {
          position: relative;
          flex: 0 0 auto;
          width: 66px;
          height: 66px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: crestFloat 7.4s ease-in-out infinite;
        }
        .mm-crest::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 42% 34%, rgba(240, 216, 148, 0.16), transparent 66%);
          filter: blur(1px);
        }
        .mm-crest .crest-orbit {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(214, 185, 110, 0.26);
          pointer-events: none;
        }
        .mm-crest .crest-orbit.o1 { border-style: dashed; animation: crestSpin 22s linear infinite; }
        .mm-crest .crest-orbit.o2 {
          inset: 8px;
          border-color: rgba(214, 185, 110, 0.15);
          border-style: dotted;
          animation: crestSpinRev 30s linear infinite;
        }
        .mm-crest .crest-swords {
          position: relative;
          width: 78%;
          height: 78%;
          overflow: visible;
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 12px rgba(214, 185, 110, 0.22));
          animation: crestBreath 5.6s ease-in-out infinite;
        }
        .mm-crest .blade { transform-box: fill-box; transform-origin: center; }
        .mm-crest .blade-a { animation: bladeSwayA 6.4s ease-in-out infinite; }
        .mm-crest .blade-b { animation: bladeSwayB 6.4s ease-in-out infinite; }
        .mm-crest .crest-core { animation: corePulse 3.2s ease-in-out infinite; }
        .mm-crest .crest-core-dot { animation: corePulse 3.2s ease-in-out .2s infinite; }
        .mm-crest .crest-shine {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          z-index: 2;
          pointer-events: none;
          background: linear-gradient(112deg, transparent 30%, rgba(255, 246, 220, 0.22) 48%, transparent 64%);
          background-size: 240% 100%;
          mix-blend-mode: screen;
          opacity: .55;
          animation: crestShineSweep 7.2s linear infinite;
        }
        .mm-crest .crest-spark {
          position: absolute;
          width: 3.5px;
          height: 3.5px;
          border-radius: 50%;
          background: var(--gold-bright);
          box-shadow: 0 0 9px rgba(240, 216, 148, 0.85);
          animation: sparkBreath 3.6s ease-in-out infinite;
        }
        .mm-crest .crest-spark.s1 { top: -1px; left: 50%; margin-left: -2px; }
        .mm-crest .crest-spark.s2 { right: -1px; top: 50%; margin-top: -2px; animation-delay: .9s; }
        .mm-crest .crest-spark.s3 { bottom: -1px; left: 50%; margin-left: -2px; animation-delay: 1.8s; }
        .mm-crest .crest-spark.s4 { left: -1px; top: 50%; margin-top: -2px; animation-delay: 2.7s; }

        .mm-brand-text { min-width: 0; }
        .mm-brand-text h1 {
          font-family: var(--font-calligraphy);
          font-size: clamp(26px, 2.5vw, 36px);
          font-weight: 400;
          line-height: 1.12;
          letter-spacing: 2px;
          background: linear-gradient(112deg, #f7ecd2, #d6b96e 46%, #b08e4a 72%, #e7cf95);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          white-space: nowrap;
        }
        .mm-brand-sub {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 3px;
          font-size: 12px;
          letter-spacing: 1.6px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mm-brand-sub i {
          width: 4px;
          height: 4px;
          flex: 0 0 auto;
          transform: rotate(45deg);
          background: var(--gold);
          opacity: 0.55;
        }

        .mm-head-right { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
        .mm-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 11.5px;
          letter-spacing: 1px;
          color: var(--text-primary);
          border: 1px solid rgba(214, 185, 110, 0.2);
          background: rgba(214, 185, 110, 0.05);
        }
        .mm-live {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #6fae86;
          box-shadow: 0 0 8px rgba(111, 174, 134, 0.9);
          animation: corePulse 2.6s ease-in-out infinite;
        }
        .mm-version {
          font-size: 11px;
          letter-spacing: 1.4px;
          color: var(--text-secondary);
          opacity: 0.72;
          font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
        }

        /* ===== 三带 ===== */
        .mm-deck {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: clamp(18px, 4vh, 44px);
        }
        .mm-band { display: flex; flex-direction: column; gap: 10px; }
        .mm-band-head { display: flex; align-items: center; gap: 9px; height: 20px; }
        .mm-index {
          font-family: var(--font-calligraphy);
          font-size: 18px;
          line-height: 1;
          color: var(--gold);
          opacity: 0.9;
        }
        .mm-band-label {
          font-size: 12.5px;
          letter-spacing: 5px;
          color: var(--text-primary);
          opacity: 0.9;
        }
        .mm-band-hint {
          font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
          font-size: 9px;
          letter-spacing: 2.6px;
          color: var(--text-secondary);
          opacity: 0.45;
          padding-top: 1px;
        }
        .mm-rule {
          flex: 1 1 auto;
          height: 1px;
          margin-left: 4px;
          background: linear-gradient(90deg, rgba(214, 185, 110, 0.26), rgba(214, 185, 110, 0.02));
        }

        .mm-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 10px;
        }
        .mm-span-3 { grid-column: span 3; }

        /* ===== 主牌：开始游戏 ===== */
        .mm-hero {
          grid-column: span 6;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 18px;
          min-height: clamp(126px, 17.5vh, 174px);
          padding: 20px 24px;
          text-align: left;
          cursor: pointer;
          border-radius: 18px;
          border: 1px solid rgba(240, 216, 148, 0.4);
          background:
            radial-gradient(120% 160% at 8% -20%, rgba(240, 216, 148, 0.16), transparent 58%),
            linear-gradient(152deg, rgba(58, 48, 26, 0.58), rgba(15, 18, 24, 0.92) 62%);
          box-shadow: 0 20px 46px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 246, 220, 0.14);
          transition: transform var(--dur) var(--ease-ios),
            border-color var(--dur) var(--ease-ios),
            box-shadow var(--dur) var(--ease-ios);
        }
        .mm-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: inset 0 0 40px rgba(240, 216, 148, 0.06);
          animation: mmHeroBreath 6.5s ease-in-out infinite;
        }
        @keyframes mmHeroBreath {
          0%, 100% { opacity: .45; }
          50% { opacity: 1; }
        }
        .mm-hero-sheen {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -60%;
          width: 46%;
          pointer-events: none;
          transform: skewX(-16deg);
          background: linear-gradient(90deg, transparent, rgba(255, 246, 220, 0.14), transparent);
          transition: left .75s var(--ease-ios);
        }
        .mm-hero:hover .mm-hero-sheen { left: 130%; }
        .mm-hero:hover {
          transform: translateY(-2px);
          border-color: rgba(248, 232, 190, 0.72);
          box-shadow: 0 26px 56px rgba(0, 0, 0, 0.55),
            0 0 34px rgba(214, 185, 110, 0.16),
            inset 0 1px 0 rgba(255, 246, 220, 0.2);
        }
        .mm-hero:active { transform: translateY(0) scale(0.995); }

        .mm-hero-icon {
          position: relative;
          flex: 0 0 auto;
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #f7e6b6;
          border: 1px solid rgba(240, 216, 148, 0.45);
          background:
            radial-gradient(circle at 34% 26%, rgba(255, 248, 226, 0.22), transparent 62%),
            linear-gradient(150deg, rgba(214, 185, 110, 0.24), rgba(120, 92, 40, 0.12));
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45), inset 0 0 18px rgba(240, 216, 148, 0.16);
          transition: transform .4s var(--ease-spring), box-shadow .4s var(--ease-ios);
        }
        .mm-hero:hover .mm-hero-icon {
          transform: rotate(-6deg) scale(1.05);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(240, 216, 148, 0.3);
        }
        .mm-hero-text { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .mm-hero-title {
          font-family: var(--font-calligraphy);
          font-size: clamp(25px, 2.4vw, 33px);
          line-height: 1.1;
          letter-spacing: 4px;
          background: linear-gradient(104deg, #fdf5e2, #e5c886 52%, #c8a158);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .mm-hero-desc {
          font-size: 12px;
          letter-spacing: 0.6px;
          color: var(--text-secondary);
          opacity: 0.88;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mm-hero-key {
          margin-left: auto;
          flex: 0 0 auto;
          align-self: flex-start;
          padding: 3px 8px;
          border-radius: 6px;
          font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
          font-size: 9.5px;
          letter-spacing: 1.2px;
          color: var(--gold-bright);
          opacity: 0.62;
          border: 1px solid rgba(240, 216, 148, 0.3);
          background: rgba(0, 0, 0, 0.25);
        }

        /* ===== 内容牌 ===== */
        .mm-tile {
          position: relative;
          grid-column: span 3;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: clamp(84px, 11.2vh, 108px);
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          border-radius: 14px;
          border: 1px solid rgba(214, 185, 110, 0.15);
          background: linear-gradient(158deg, rgba(30, 34, 44, 0.66), rgba(13, 16, 22, 0.86));
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: transform var(--dur) var(--ease-ios),
            border-color var(--dur) var(--ease-ios),
            background var(--dur) var(--ease-ios),
            box-shadow var(--dur) var(--ease-ios);
          overflow: hidden;
        }
        .mm-tile::before {
          content: '';
          position: absolute;
          left: 0;
          top: 14%;
          bottom: 14%;
          width: 2px;
          border-radius: 2px;
          background: linear-gradient(180deg, transparent, var(--gold), transparent);
          opacity: 0;
          transition: opacity var(--dur) var(--ease-ios);
        }
        .mm-tile:hover {
          transform: translateY(-2px);
          border-color: rgba(214, 185, 110, 0.46);
          background: linear-gradient(158deg, rgba(40, 44, 56, 0.8), rgba(17, 20, 27, 0.92));
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.42), 0 0 22px rgba(214, 185, 110, 0.08);
        }
        .mm-tile:hover::before { opacity: 1; }
        .mm-tile:active { transform: translateY(0) scale(0.994); }

        .mm-tile-icon {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          color: var(--gold-bright);
          border: 1px solid rgba(214, 185, 110, 0.24);
          background: rgba(214, 185, 110, 0.07);
          transition: transform var(--dur) var(--ease-spring),
            background var(--dur) var(--ease-ios),
            border-color var(--dur) var(--ease-ios);
        }
        .mm-tile:hover .mm-tile-icon {
          transform: translateY(-1px) rotate(-4deg);
          border-color: rgba(240, 216, 148, 0.5);
          background: rgba(214, 185, 110, 0.14);
        }
        .mm-tile-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .mm-tile-text b {
          font-size: 14.5px;
          font-weight: 500;
          letter-spacing: 0.6px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mm-tile-text em {
          font-style: normal;
          font-size: 11px;
          letter-spacing: 0.2px;
          color: var(--text-secondary);
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mm-tile-go {
          margin-left: auto;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          color: var(--gold);
          opacity: 0;
          transform: translateX(-5px);
          transition: opacity var(--dur) var(--ease-ios), transform var(--dur) var(--ease-ios);
        }
        .mm-tile:hover .mm-tile-go { opacity: 0.85; transform: none; }

        /* ===== 装饰牌：品牌铭牌（占据系统带最后一格） ===== */
        .mm-plate {
          grid-column: span 3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          min-height: clamp(84px, 11.2vh, 108px);
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px dashed rgba(214, 185, 110, 0.14);
          background: linear-gradient(150deg, rgba(214, 185, 110, 0.035), transparent 70%);
        }
        .mm-plate-mark {
          font-family: var(--font-calligraphy);
          font-size: 19px;
          letter-spacing: 5px;
          color: var(--gold);
          opacity: 0.5;
        }
        .mm-plate-sub {
          font-size: 10.5px;
          letter-spacing: 1px;
          color: var(--text-secondary);
          opacity: 0.45;
        }

        /* ===== 页脚 ===== */
        .mm-foot {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: clamp(10px, 1.4vh, 15px);
          font-size: 11px;
          letter-spacing: 0.4px;
          color: var(--text-secondary);
          opacity: 0.66;
        }
        .mm-foot::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(214, 185, 110, 0.16) 12%, rgba(214, 185, 110, 0.16) 88%, transparent);
        }
        .mm-foot kbd {
          display: inline-block;
          margin-right: 5px;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
          font-size: 9.5px;
          color: var(--gold-bright);
          border: 1px solid rgba(214, 185, 110, 0.3);
          background: rgba(0, 0, 0, 0.25);
        }
        .mm-foot-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.4;
        }
        .mm-foot-mono { margin-left: auto; font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; opacity: 0.7; }

        /* ===== 响应式 ===== */
        @media (max-width: 1180px) {
          .mm-hero { grid-column: span 12; }
          .mm-tile, .mm-plate { grid-column: span 6; }
        }
        @media (max-width: 760px) {
          .mm-stage { gap: 12px; padding: 14px 14px 12px; }
          .mm-crest { width: 48px; height: 48px; }
          .mm-brand-sub { font-size: 11px; letter-spacing: 1px; gap: 7px; }
          .mm-brand-sub span:last-child { display: none; }
          .mm-head-right .mm-version { display: none; }
          .mm-deck { justify-content: flex-start; gap: 16px; }
          .mm-hero { grid-column: span 12; min-height: 0; padding: 15px 16px; gap: 13px; }
          .mm-hero-icon { width: 50px; height: 50px; }
          .mm-hero-key { display: none; }
          .mm-tile, .mm-plate { grid-column: span 12; min-height: 66px; }
          .mm-rose { opacity: 0.05; }
          .mm-foot { flex-wrap: wrap; font-size: 10px; }
          .mm-foot-mono { display: none; }
        }
        @media (max-height: 720px) and (min-width: 761px) {
          .mm-brand-text h1 { font-size: 26px; }
          .mm-crest { width: 48px; height: 48px; }
          .mm-hero { min-height: 104px; }
          .mm-tile, .mm-plate { min-height: 66px; }
        }

        /* ===== 品牌徽记动画（沿用原视觉语言） ===== */
        @keyframes crestSpin { to { transform: rotate(360deg); } }
        @keyframes crestSpinRev { to { transform: rotate(-360deg); } }
        @keyframes crestFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes crestShineSweep {
          0% { background-position: 140% 50%; opacity: .3; }
          45% { opacity: .85; }
          100% { background-position: -80% 50%; opacity: .3; }
        }
        @keyframes crestBreath {
          0%, 100% { transform: scale(0.985); }
          50% { transform: scale(1.025); }
        }
        @keyframes bladeSwayA {
          0%, 100% { transform: translate(-1.5px, 0.5px) rotate(-1.8deg); }
          50% { transform: translate(1.5px, -0.5px) rotate(1.8deg); }
        }
        @keyframes bladeSwayB {
          0%, 100% { transform: translate(1.5px, 0.5px) rotate(1.8deg); }
          50% { transform: translate(-1.5px, -0.5px) rotate(-1.8deg); }
        }
        @keyframes corePulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes sparkBreath {
          0%, 100% { opacity: 0.18; transform: scale(0.65); }
          45% { opacity: 1; transform: scale(1.15); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mm-crest .crest-orbit,
          .mm-crest .crest-swords,
          .mm-crest .crest-shine,
          .mm-crest .crest-spark,
          .mm-crest .blade,
          .mm-crest,
          .mm-rose,
          .mm-aura,
          .mm-hero::after,
          .mm-live { animation: none !important; }
          .mm-hero-sheen { display: none; }
          .mm-tile, .mm-hero { transition: border-color var(--dur) var(--ease-ios); }
        }
      `}</style>
    </div>
  );
}
