/**
 * 对局界面主样式（原 GameBoard.jsx 内联 <style>，抽出以便单独维护）。
 * 仍然通过 <style> 注入到 .game-board 内部，保持原有的层叠顺序与优先级。
 */
const gameBoardStyles = `
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
          .game-board .hand-cards { padding: 0 6px 2px; }
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

        /* 窄桌顶栏：图标化，给阶段信息留出空间 */
        @media (min-width: 721px) and (max-width: 1180px) {
          .game-board .board-header .header-action { padding: 4px 8px; }
          .game-board .board-header .header-action .btn-label { display: none; }
          .game-board .board-header .header-action .ui-icon { margin-right: 0; }
        }

        /* 宽屏桌面：放大牌面与右栏，避免 1920 下内容过散 */
        @media (min-width: 1600px) {
          .game-board { --rail-w: 460px; --rail-pad: 30px; }
          .game-board .board-header { padding: 10px 18px; gap: 10px; }
          .game-board .board-header .phase-info { font-size: 15px; }
          .game-board .hand-zone { padding: 10px 16px 12px; }
          .game-board .hand-title { font-size: 15px; }
          .game-board .hand-cards {
            padding: 0 10px 4px;
            min-height: calc(162px * var(--hand-scale, 1));
          }
          .game-board[data-layout] .hand-zone .game-card {
            width: calc(112px * var(--hand-scale, 1));
            height: calc(164px * var(--hand-scale, 1));
          }
          .game-board[data-layout] .self-character {
            width: 270px;
            padding: 14px 16px;
          }
          .game-board[data-layout] .other-players .player-area {
            width: calc(190px * var(--opponent-scale, 1)) !important;
            min-width: calc(174px * var(--opponent-scale, 1)) !important;
            padding: calc(14px * var(--opponent-scale, 1));
          }
          .game-board[data-layout] .other-players .player-avatar {
            width: calc(52px * var(--opponent-scale, 1));
            height: calc(52px * var(--opponent-scale, 1));
            font-size: calc(22px * var(--opponent-scale, 1));
          }
          .game-board[data-layout] .other-players .player-name {
            font-size: calc(15px * var(--opponent-scale, 1));
          }
          .game-board .hub-rose {
            width: min(62vh, 560px);
            height: min(62vh, 560px);
          }
          .game-board .table-hub::before { width: min(56vh, 510px); }
          .game-board .table-hub::after { width: min(46vh, 420px); }
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

        /* ============================================================
           手机横屏（高度 ≤ 600px）：左牌桌 + 右侧操作栏 + 底部通栏手牌
           竖屏规则保持原样；这里只收紧高度、放大可用横向空间。
           ============================================================ */
        @media (orientation: landscape) and (max-height: 600px) {
          [data-platform="mobile"] .game-board[data-layout] {
            /* 横屏布局 token：改一处即可同时调整对手卡/手牌/右栏 */
            --rail-w: clamp(228px, 30vw, 260px);
            --rail-gap: 6px;
            --safe-l: env(safe-area-inset-left, 0px);
            --safe-r: env(safe-area-inset-right, 0px);
            --opp-card-w: 140px;
            --hand-card-w: 60px;
            --hand-card-h: 88px;
          }

          /* 顶栏单行 44px 触控按钮；左右让开刘海/挖孔 */
          [data-platform="mobile"] .game-board[data-layout] .board-header {
            margin: 3px max(6px, var(--safe-r)) 0 max(6px, var(--safe-l));
            padding: 3px 6px;
            gap: 4px;
            min-height: 50px;
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            border-radius: 9px;
            scrollbar-width: none;
          }
          [data-platform="mobile"] .game-board[data-layout] .board-header::-webkit-scrollbar { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .board-header .btn-small {
            min-height: 44px !important;
            height: 44px;
            min-width: 40px;
            padding: 2px 6px;
            border-radius: 8px;
          }
          [data-platform="mobile"] .game-board[data-layout] .board-header .btn-small .ui-icon {
            width: 18px;
            height: 18px;
          }
          [data-platform="mobile"] .game-board[data-layout] .board-header .deck-info {
            font-size: 9.5px;
            padding: 1px 5px;
            border-radius: 6px;
          }
          [data-platform="mobile"] .game-board[data-layout] .board-header .phase-info {
            flex: 1 1 auto;
            max-width: none;
            font-size: 9.5px;
          }

          /* 主区：有操作面板时右侧留出操作栏，否则让牌桌占满 */
          [data-platform="mobile"] .game-board[data-layout] .board-main {
            padding: 3px max(6px, var(--safe-r)) 2px max(6px, var(--safe-l));
            gap: 3px;
            overflow: hidden;
          }
          [data-platform="mobile"] .game-board[data-layout].has-action .board-main {
            padding-right: calc(var(--rail-w) + var(--rail-gap) + max(6px, var(--safe-r)));
          }

          /* 对手卡：紧凑横排，可横向滚动，不再撑高主区 */
          [data-platform="mobile"] .game-board[data-layout] .other-players {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            justify-content: flex-start;
            gap: 5px;
            padding: 1px 1px 2px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .player-area {
            flex: 0 0 auto;
            width: var(--opp-card-w) !important;
            min-width: var(--opp-card-w) !important;
            max-width: var(--opp-card-w);
            padding: 5px 6px !important;
            border-radius: 9px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players.opponents-5 .player-area,
          [data-platform="mobile"] .game-board[data-layout] .other-players.opponents-6 .player-area {
            width: calc(var(--opp-card-w) - 20px) !important;
            min-width: calc(var(--opp-card-w) - 20px) !important;
            max-width: calc(var(--opp-card-w) - 20px);
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .player-info {
            gap: 6px;
            margin-bottom: 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .player-avatar {
            width: 30px !important;
            height: 30px !important;
            font-size: 13px !important;
            border-width: 1.5px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .player-name { font-size: 12px !important; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .char-name { font-size: 9px !important; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .hp-dot { font-size: 9px !important; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .hp-dot .ui-icon {
            width: 9px;
            height: 9px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .distance-chip {
            font-size: 9px !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .status-chips {
            gap: 2px;
            margin: 0 0 2px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .status-chip {
            font-size: 9px !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .bond-tags {
            gap: 2px;
            margin: 0 0 2px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .bond-tag {
            font-size: 9px !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-area {
            margin: 2px 0;
            gap: 2px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-area-title { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-slot.empty { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-slot {
            min-height: 0 !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-slot-name,
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-tag { font-size: 9px !important; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .equip-slot-type { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .judge-area { margin: 2px 0; gap: 2px; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .judge-tag {
            font-size: 9px !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .opponent-hand {
            margin-top: 3px;
            gap: 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .mini-back {
            width: 10px;
            height: 15px;
            border-radius: 2px;
            margin-left: -4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .hand-count { font-size: 9px; }
          [data-platform="mobile"] .game-board[data-layout] .other-players .skill-tags {
            gap: 2px;
            margin-top: 3px;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .skill-tag {
            font-size: 9px !important;
            padding: 0 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .other-players .skill-type-badge { display: none; }

          /* 中央只保留场面 chips；罗盘/阶段轨/脉搏/提示都让位给牌桌 */
          [data-platform="mobile"] .game-board[data-layout] .board-center {
            flex: 1 1 auto;
            min-height: 0;
            justify-content: flex-start;
            padding: 0;
            gap: 2px;
          }
          [data-platform="mobile"] .game-board[data-layout] .table-hub,
          [data-platform="mobile"] .game-board[data-layout] .phase-track,
          [data-platform="mobile"] .game-board[data-layout] .tactical-pulse,
          [data-platform="mobile"] .game-board[data-layout] .stage-judges,
          [data-platform="mobile"] .game-board[data-layout] .turn-tip { display: none !important; }
          [data-platform="mobile"] .game-board[data-layout] .table-stage { gap: 2px; }
          [data-platform="mobile"] .game-board[data-layout] .table-chips { gap: 4px; }
          [data-platform="mobile"] .game-board[data-layout] .chip {
            font-size: 9px;
            padding: 1px 6px;
            border-radius: 6px;
          }

          /* 操作面板固定到右栏，完整可见、内部可滚动 */
          [data-platform="mobile"] .game-board[data-layout] .board-center .action-panel {
            position: fixed !important;
            top: 56px !important;
            right: max(6px, var(--safe-r)) !important;
            bottom: auto !important;
            left: auto !important;
            width: var(--rail-w) !important;
            min-width: 0 !important;
            max-width: var(--rail-w) !important;
            max-height: calc(100vh - 62px) !important;
            max-height: calc(100dvh - 62px) !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            padding: 8px 10px !important;
            border-radius: 10px !important;
            z-index: 95 !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel h3 {
            font-size: 13px !important;
            margin-bottom: 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .action-hint {
            font-size: 10.5px !important;
            line-height: 1.45;
            margin-bottom: 6px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .recommend-hint {
            font-size: 9.5px !important;
            margin: 0 0 5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .picked-card { margin-left: 4px; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .skill-actions {
            gap: 4px !important;
            margin-bottom: 5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .skill-actions-label { font-size: 9.5px; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .target-selection {
            margin-bottom: 5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .target-selection p {
            font-size: 10px !important;
            margin-bottom: 3px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .target-list { gap: 4px !important; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .target-distance-hint { font-size: 9.5px; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .action-buttons {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .btn {
            min-height: 30px !important;
            padding: 3px 6px !important;
            font-size: 10.5px !important;
            line-height: 1.3;
            white-space: normal;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .action-buttons .btn { width: 100%; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .hand-selection {
            gap: 4px !important;
            margin-bottom: 5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .hand-selection .game-card {
            width: 54px !important;
            height: 78px !important;
            min-width: 54px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .hand-selection .card-brief { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .equip-replace-warning,
          [data-platform="mobile"] .game-board[data-layout] .action-panel .equip-replace-hint {
            font-size: 10px;
            margin-bottom: 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .action-panel .equip-replace-list { gap: 4px; }

          /* 底部：手牌通栏，武将卡压缩到左侧 128px */
          [data-platform="mobile"] .game-board[data-layout] .self-zone {
            flex-direction: row-reverse !important;
            align-items: flex-end !important;
            gap: 5px !important;
            padding: 2px max(6px, var(--safe-r)) calc(4px + env(safe-area-inset-bottom)) max(6px, var(--safe-l)) !important;
            width: 100% !important;
          }
          [data-platform="mobile"] .game-board[data-layout].has-action .self-zone {
            width: calc(100vw - var(--rail-w) - 12px - var(--safe-r)) !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-zone .hand-zone {
            flex: 1 1 auto;
            width: auto !important;
            min-width: 0;
            padding: 3px 5px 4px !important;
            border-radius: 10px !important;
            gap: 2px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-toolbar { gap: 4px !important; }
          [data-platform="mobile"] .game-board[data-layout] .hand-title { display: none !important; }
          [data-platform="mobile"] .game-board[data-layout] .hand-count-badge,
          [data-platform="mobile"] .game-board[data-layout] .hand-sort-badge {
            font-size: 9px !important;
            padding: 0 5px !important;
            white-space: nowrap;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-sort-badge small { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .hand-sort-btn {
            position: relative;
            min-height: 30px !important;
            padding: 0 8px !important;
            font-size: 10px !important;
          }
          /* 视觉 30px，隐形热区补到 44px */
          [data-platform="mobile"] .game-board[data-layout] .hand-sort-btn::after {
            content: "";
            position: absolute;
            left: -4px;
            right: -4px;
            top: -7px;
            bottom: -7px;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-sort-btn .ui-icon {
            width: 11px;
            height: 11px;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-cards {
            min-height: calc(var(--hand-card-h) * var(--hand-scale, 1)) !important;
            max-height: none !important;
            gap: 4px !important;
            overflow-y: hidden !important;
            padding-bottom: 0;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-zone .game-card {
            width: calc(var(--hand-card-w) * var(--hand-scale, 1)) !important;
            height: calc(var(--hand-card-h) * var(--hand-scale, 1)) !important;
            min-width: calc(var(--hand-card-w) * var(--hand-scale, 1)) !important;
            border-radius: 8px;
          }
          [data-platform="mobile"] .game-board[data-layout] .hand-zone .card-name { font-size: 10px; }
          [data-platform="mobile"] .game-board[data-layout] .hand-zone .card-brief {
            font-size: 8px;
            max-width: 54px;
          }

          [data-platform="mobile"] .game-board[data-layout] .self-character {
            width: 128px !important;
            min-width: 128px !important;
            max-width: 128px;
            padding: 5px 6px !important;
            gap: 3px !important;
            border-radius: 10px !important;
            align-self: flex-end;
            max-height: 120px;
            overflow: hidden;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-avatar {
            width: 26px;
            height: 26px;
            font-size: 11px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-char-head { gap: 5px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-name { font-size: 11px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-char-name { font-size: 9px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .hp-dot { font-size: 9px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .hp-dot .ui-icon {
            width: 8px;
            height: 8px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .distance-chip {
            font-size: 9px;
            padding: 0 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .status-chips {
            gap: 2px;
            margin-bottom: 1px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .status-chip {
            font-size: 9px;
            padding: 0 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .bond-tags { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-tags-label { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-tags { gap: 2px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-equip-section { gap: 2px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-equip-slot.empty { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .self-equip-slot {
            min-height: 0 !important;
            padding: 1px 4px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .equip-slot-name,
          [data-platform="mobile"] .game-board[data-layout] .self-character .equip-tag { font-size: 9px; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .equip-slot-type { display: none; }
          [data-platform="mobile"] .game-board[data-layout] .self-character .judge-tag {
            font-size: 9px;
            padding: 0 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .skill-tag {
            font-size: 9px;
            padding: 0 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .self-character .skill-type-badge { display: none; }

          /* 日志改成左侧抽屉：不挡右侧操作栏，也不铺满整屏 */
          [data-platform="mobile"] .game-board[data-layout] .log-panel {
            position: fixed !important;
            top: 56px !important;
            left: max(6px, var(--safe-l)) !important;
            right: auto !important;
            bottom: auto !important;
            width: min(300px, 42vw) !important;
            height: auto !important;
            max-height: calc(100vh - 132px) !important;
            max-height: calc(100dvh - 132px) !important;
            z-index: 96 !important;
            padding: 8px 10px !important;
            border-radius: 10px !important;
            font-size: 10.5px !important;
          }
          [data-platform="mobile"] .game-board[data-layout] .log-panel .log-title {
            font-size: 11px;
            margin-bottom: 4px;
          }
          [data-platform="mobile"] .game-board[data-layout] .log-panel .log-line { padding: 1px 0; }
          [data-platform="mobile"] .game-board[data-layout] .log-panel .log-collapse {
            min-height: 30px;
            padding: 1px 8px;
            font-size: 10px;
          }

          /* 悬浮确认条 / 日志窄条让位 */
          [data-platform="mobile"] .game-board[data-layout] .quick-play-bar { display: none !important; }
          [data-platform="mobile"] .game-board[data-layout] .log-strip { display: none !important; }
        }
      `;

export default gameBoardStyles;
