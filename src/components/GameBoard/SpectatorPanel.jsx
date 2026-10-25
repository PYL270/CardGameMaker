import React from 'react';
import Icon from '../ui/Icon';

/**
 * 观战栏：只读公共信息 + 日志/退出；不占座位、不提供任何出牌操作。
 */
export default function SpectatorPanel({
  roomCode = '',
  playerCount = 0,
  spectatorCount = 0,
  round = 0,
  phaseLabel = '',
  currentName = '',
  deck = {},
  showLog = false,
  onToggleLog,
  onExit,
  waiting = false,
}) {
  return (
    <aside className="spectator-panel panel" aria-label="观战栏">
      <div className="spectator-head">
        <span className="spectator-badge">观战</span>
        <span className="spectator-readonly">只读</span>
        {roomCode && <span className="spectator-room">{`房间 ${roomCode}`}</span>}
      </div>
      {waiting ? (
        <p className="spectator-waiting">等待房主开始对局 / 正在同步公共牌桌…</p>
      ) : (
        <>
          <div className="spectator-stats">
            <span>玩家 <b>{playerCount}</b></span>
            <span>观战 <b>{spectatorCount}</b></span>
          </div>
          <div className="spectator-meta">
            <span>第 <b>{round || 0}</b> 回合</span>
            <span>{currentName ? `${currentName} 行动中` : '等待行动'}</span>
            <span>{phaseLabel || '对局中'}</span>
          </div>
          <div className="spectator-meta">
            <span>牌堆 <b>{deck.remaining ?? 0}</b>/{deck.total ?? 0}</span>
            <span>弃牌 <b>{deck.discarded ?? 0}</b></span>
          </div>
        </>
      )}
      <p className="spectator-tip">观战不占座位，仅观看对局；公共信息与玩家一致。</p>
      <div className="spectator-actions">
        <button type="button" className="btn btn-small" onClick={onToggleLog}>
          <Icon name="log" size={14} />{showLog ? '收起日志' : '查看日志'}
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={onExit}>
          <Icon name="exit" size={14} />退出观战
        </button>
      </div>
    </aside>
  );
}
