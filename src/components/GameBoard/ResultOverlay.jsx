import React from 'react';
import Icon from '../ui/Icon';

/**
 * ResultOverlay - 终局结算浮层
 * 支持立即重开，不会卡在战败界面
 */
export default function ResultOverlay({
  won, round, onRestart, onMenu, restarting = false, canRestart = true, menuLabel = '返回主菜单',
  subtitle = null, title = null, icon = null,
}) {
  return (
    <div className="overlay">
      <div className="panel result-panel animate-fade-in">
        <div className={`result-icon ${won ? 'win' : 'lose'}`}>{icon || (won ? '胜' : '负')}</div>
        <h2 className={won ? 'win' : 'lose'}>{title || (won ? '胜利！' : '战败')}</h2>
        {subtitle && <p className="result-team-sub">{subtitle}</p>}
        <p className="result-sub">共进行 {round} 回合</p>
        <div className="result-actions">
          {canRestart ? (
            <button className="btn btn-primary" onClick={onRestart} disabled={restarting}>
              {restarting ? '准备中…' : '再来一局'}
            </button>
          ) : (
            <button className="btn" disabled>
              <Icon name="clock" size={15} /><span>等待房主重开…</span>
            </button>
          )}
          <button className="btn" onClick={onMenu}>{menuLabel}</button>
        </div>
      </div>

      <style>{`
        .result-panel {
          text-align: center;
          min-width: min(340px, 88vw);
          padding: 32px 30px 26px;
          border-radius: 20px;
        }
        .result-icon {
          position: relative;
          width: 86px; height: 86px;
          margin: 0 auto 16px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          font-family: var(--font-serif);
          font-size: 36px; font-weight: 800;
          border: 1px solid rgba(214, 185, 110, 0.6);
          color: var(--gold-bright);
          background: radial-gradient(circle at 35% 28%, rgba(214, 185, 110, 0.16), rgba(10, 12, 17, 0.92) 72%);
          animation: medalIn 0.65s cubic-bezier(0.2, 0.9, 0.3, 1.2) both, medalAura 4s ease-in-out 0.7s infinite;
        }
        .result-icon::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 1px solid rgba(214, 185, 110, 0.35);
          animation: medalRing 2.6s ease-out infinite;
        }
        .result-icon.lose {
          color: #d98a82;
          border-color: rgba(208, 87, 79, 0.65);
          background: radial-gradient(circle at 35% 28%, rgba(208, 87, 79, 0.14), rgba(10, 12, 17, 0.92) 72%);
        }
        .result-icon.lose::before { border-color: rgba(208, 87, 79, 0.35); }
        @keyframes medalIn {
          0% { opacity: 0; transform: scale(0.4) rotate(-28deg); }
          60% { opacity: 1; transform: scale(1.12) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes medalAura {
          0%, 100% { box-shadow: inset 0 0 18px rgba(214, 185, 110, 0.1), 0 10px 26px rgba(0, 0, 0, 0.55); }
          50% { box-shadow: inset 0 0 22px rgba(214, 185, 110, 0.18), 0 0 30px rgba(214, 185, 110, 0.18), 0 10px 26px rgba(0, 0, 0, 0.55); }
        }
        @keyframes medalRing {
          0% { transform: scale(0.86); opacity: 0.75; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .result-panel h2 {
          font-size: 30px;
          margin-bottom: 6px;
          letter-spacing: 2px;
        }
        .result-panel h2.win {
          color: var(--gold-bright);
          text-shadow: 0 0 22px rgba(214, 185, 110, 0.25);
        }
        .result-panel h2.lose {
          color: #d98a82;
          text-shadow: 0 0 20px rgba(208, 87, 79, 0.22);
        }
        .result-team-sub {
          color: var(--gold-bright);
          font-size: 14px;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }
        .result-sub {
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 24px;
        }
        .result-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .result-actions .btn { width: 100%; padding: 12px 20px; font-size: 15px; }
        @media (min-width: 420px) {
          .result-actions { flex-direction: row; }
          .result-actions .btn { width: auto; flex: 1; }
        }
      `}</style>
    </div>
  );
}
