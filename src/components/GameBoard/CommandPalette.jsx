import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon';

/**
 * 指令过滤：中文 label / 拼音关键词 / 快捷键均可 includes 匹配。
 */
export function filterCommands(commands = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return commands;
  return commands.filter(command => {
    const haystack = [
      command.label,
      command.title,
      command.shortcut,
      ...(Array.isArray(command.keywords) ? command.keywords : []),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * 战局指令台（Ctrl+K）：搜索 + ↑↓/Enter/Esc；本组件只负责展示与键盘选择。
 */
export default function CommandPalette({
  open = false,
  onClose,
  commands = [],
  roomCode = '',
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(prev => {
      if (filtered[prev] && !filtered[prev].disabled) return prev;
      const firstEnabled = filtered.findIndex(command => !command.disabled);
      return firstEnabled >= 0 ? firstEnabled : 0;
    });
  }, [open, filtered]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const move = (delta) => {
    if (filtered.length === 0) return;
    let next = activeIndex;
    for (let guard = 0; guard < filtered.length; guard += 1) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const runActive = () => {
    const command = filtered[activeIndex];
    if (!command || command.disabled) return;
    onClose?.();
    command.run?.();
  };

  return (
    <div
      className="command-palette-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="战局指令">
        <div className="command-palette-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索指令…（推荐 / 确认 / 整理 / 日志）"
            aria-label="搜索指令"
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                move(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                move(-1);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runActive();
              }
            }} />
          <kbd>Ctrl K</kbd>
        </div>

        <div className="command-palette-meta">
          <span>{roomCode ? `房间 ${roomCode}` : '单机对局'}</span>
          <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
        </div>

        <div className="command-list" role="listbox" aria-label="指令列表">
          {filtered.length === 0 && (
            <div className="command-empty">没有匹配的指令，换个关键词试试。</div>
          )}
          {filtered.map((command, index) => (
            <button
              type="button"
              key={command.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`command-item${index === activeIndex ? ' active' : ''}${command.disabled ? ' disabled' : ''}`}
              disabled={command.disabled}
              title={command.hint || command.title || command.label}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                if (command.disabled) return;
                onClose?.();
                command.run?.();
              }}>
              <span className="command-icon"><Icon name={command.icon || 'play'} size={15} /></span>
              <span className="command-copy">
                <b>{command.label}</b>
                <small>{command.hint || command.title || ''}</small>
              </span>
              {command.shortcut && <kbd className="command-shortcut">{command.shortcut}</kbd>}
              {command.disabled && <span className="command-off">不可用</span>}
            </button>
          ))}
        </div>

        <div className="command-foot">
          <span>战局指令台 · 仅当前牌桌生效</span>
          <button type="button" className="btn btn-small" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
