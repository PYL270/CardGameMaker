import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon';

export const CHAT_MAX_LENGTH = 200;
export const CHAT_DANMAKU_KEY = 'cgm_chat_danmaku';
export const CHAT_MUTED_KEY = 'cgm_chat_muted';

/** 读取/持久化弹幕开关（默认开启） */
export function loadDanmakuEnabled(storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return true;
    const raw = store.getItem(CHAT_DANMAKU_KEY);
    if (raw === null || raw === undefined) return true;
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function saveDanmakuEnabled(enabled, storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) store.setItem(CHAT_DANMAKU_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

/** chatMuted 兼容数组（字符串/ {id,name}）/ Set / 对象映射 */
export function normalizeMutedIds(value) {
  if (!value) return [];
  const toId = item => {
    if (typeof item === 'string') return item.trim();
    if (!item || typeof item !== 'object') return '';
    return String(item.senderId || item.id || item.name || '').trim();
  };
  if (Array.isArray(value)) return [...new Set(value.map(toId).filter(Boolean))];
  if (value instanceof Set) return [...new Set([...value].map(toId).filter(Boolean))];
  if (typeof value === 'object') {
    return Object.entries(value).filter(([, on]) => !!on).map(([id]) => String(id));
  }
  return [];
}

export function normalizeChatMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((msg, index) => {
      if (!msg || typeof msg !== 'object') return null;
      const text = String(msg.text ?? msg.content ?? msg.message ?? '').trim();
      if (!text) return null;
      return {
        ...msg,
        id: String(msg.id ?? msg.msgId ?? `${msg.senderId ?? 'anon'}-${msg.ts ?? msg.time ?? index}-${index}`),
        text,
      };
    })
    .filter(Boolean);
}

export function chatSenderId(message) {
  return String(message?.senderId ?? message?.clientId ?? message?.authorId ?? message?.from ?? '');
}

export function chatSenderName(message) {
  return String(message?.senderName ?? message?.name ?? message?.fromName ?? message?.sender?.name ?? '玩家');
}

export function chatMessageTime(message) {
  const raw = message?.ts ?? message?.time ?? message?.createdAt ?? message?.mtime;
  if (raw === undefined || raw === null || raw === '') return '';
  const date = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw).slice(11, 16);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function isSelfMessage(message, clientId) {
  return !!clientId && chatSenderId(message) === String(clientId);
}

/** 过滤屏蔽：仅过滤他人，自己消息与未知 id 永不被屏蔽 */
export function filterChatMessages(messages, { clientId = '', mutedIds = [] } = {}) {
  const muted = new Set(normalizeMutedIds(mutedIds));
  return normalizeChatMessages(messages).filter(message => {
    const senderId = chatSenderId(message);
    if (!senderId || senderId === String(clientId || '')) return true;
    return !muted.has(senderId);
  });
}

/**
 * 局内聊天面板。open=false 时不渲染，关闭不残留 pointer。
 * 所有聊天状态来自 store，本组件只负责展示/输入/屏蔽操作。
 */
export default function ChatDock({
  open = false,
  onClose,
  roomCode = '',
  messages = [],
  clientId = '',
  mutedIds = [],
  onToggleMute,
  onMarkRead,
  onSend,
  connected = true,
  spectator = false,
  danmakuEnabled = true,
  onToggleDanmaku,
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const markReadRef = useRef(onMarkRead);
  markReadRef.current = onMarkRead;
  const muted = useMemo(() => normalizeMutedIds(mutedIds), [mutedIds]);
  const visible = useMemo(
    () => filterChatMessages(messages, { clientId, mutedIds: muted }),
    [messages, clientId, muted],
  );
  const mutedNames = useMemo(() => {
    const map = new Map();
    normalizeChatMessages(messages).forEach(message => {
      const id = chatSenderId(message);
      if (id && !map.has(id)) map.set(id, chatSenderName(message));
    });
    return map;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    markReadRef.current?.();
    const timer = setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, visible.length]);

  if (!open) return null;

  const submit = async () => {
    const text = input.trim();
    if (!text || !connected || sending) return;
    setSending(true);
    setError('');
    try {
      const result = typeof onSend === 'function' ? await onSend(text.slice(0, CHAT_MAX_LENGTH)) : false;
      if (result === false) {
        setError('发送失败：当前未连接或服务不可用');
      } else {
        setInput('');
      }
    } catch {
      setError('发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="chat-dock panel" aria-label="局内聊天">
      <div className="chat-dock-head">
        <span className="chat-dock-title">局内聊天</span>
        {roomCode && <span className="chat-dock-room">{`房间 ${roomCode}`}</span>}
        <button
          type="button"
          className={`chat-danmaku-toggle ${danmakuEnabled ? 'active' : ''}`}
          onClick={() => onToggleDanmaku?.(!danmakuEnabled)}
          title={danmakuEnabled ? '关闭弹幕' : '开启弹幕'}>
          {`弹幕 ${danmakuEnabled ? '开' : '关'}`}
        </button>
        <button type="button" className="chat-dock-close" onClick={onClose} aria-label="关闭聊天">
          <Icon name="close" size={15} />
        </button>
      </div>

      {muted.length > 0 && (
        <div className="chat-muted-bar">
          <span className="chat-muted-count">{`已屏蔽 ${muted.length} 人`}</span>
          <div className="chat-muted-chips">
            {muted.map(id => (
              <button
                type="button"
                key={id}
                className="chat-muted-chip"
                title="点击取消屏蔽"
                onClick={() => onToggleMute?.(id)}>
                {mutedNames.get(id) || id.slice(0, 8)}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-messages" ref={listRef}>
        {visible.length === 0 && (
          <p className="chat-empty">暂无聊天消息，说点什么吧。</p>
        )}
        {visible.map(message => {
          const self = isSelfMessage(message, clientId);
          const senderId = chatSenderId(message);
          const time = chatMessageTime(message);
          return (
            <div className={`chat-msg ${self ? 'self' : ''}`} key={message.id}>
              <div className="chat-msg-meta">
                <span className="chat-msg-name">
                  {chatSenderName(message)}
                  {message.role === 'spectator' || message.spectator ? <em>观战</em> : null}
                  {self ? <em>我</em> : null}
                </span>
                {time && <span className="chat-msg-time">{time}</span>}
                {!self && senderId && (
                  <button
                    type="button"
                    className="chat-mute-btn"
                    title="只在本机屏蔽该玩家"
                    onClick={() => onToggleMute?.(senderId)}>
                    屏蔽
                  </button>
                )}
              </div>
              <div className="chat-msg-text">{message.text}</div>
            </div>
          );
        })}
      </div>

      {error && <p className="chat-error">{error}</p>}
      <div className="chat-compose">
        <input
          type="text"
          maxLength={CHAT_MAX_LENGTH}
          value={input}
          placeholder={connected ? '输入消息，Enter 发送…' : '未连接，暂时无法发送'}
          disabled={!connected || sending}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="聊天输入"
        />
        <button
          type="button"
          className="btn btn-small chat-send-btn"
          disabled={!connected || sending || !input.trim()}
          onClick={submit}>
          发送
        </button>
      </div>
      <div className="chat-compose-foot">
        <span>{spectator ? '观战者也可聊天 · 只读牌桌' : '仅本局玩家/观战可见'}</span>
        <span>{`${input.length}/${CHAT_MAX_LENGTH}`}</span>
      </div>
    </aside>
  );
}
