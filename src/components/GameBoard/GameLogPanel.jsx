import React, { useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import Icon from '../ui/Icon';

/**
 * 对局日志面板：logs 在此独立订阅，日志滚动/追加只重渲染本面板，
 * 不再带动整个 GameBoard（3000 行）重渲染。
 * preview 模式（SSR 测试）通过 logsProp 覆盖订阅值。
 */
export default function GameLogPanel({ logs: logsProp, showLog, logPosition, onCollapse }) {
  const storeLogs = useGameStore(s => s.logs);
  const logs = logsProp ?? storeLogs;
  const logRef = useRef(null);

  // 自动滚动日志
  useEffect(() => {
    if (showLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, showLog]);

  if (!showLog || logPosition === 'hidden') return null;
  return (
    <div className={`log-panel panel log-panel-${logPosition}`} ref={logRef}>
      <div className="log-title">
        <span>对局日志</span>
        <button className="btn btn-small log-collapse" onClick={onCollapse}>
          <Icon name="chevron-down" size={13} className="is-open" />
          <span>收起</span>
        </button>
      </div>
      {logs.slice(-40).map((log, i) => (
        <div key={i} className="log-line">{log.message}</div>
      ))}
    </div>
  );
}
