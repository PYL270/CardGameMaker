import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_MAX_LENGTH,
  normalizeChatMessages,
  normalizeMutedIds,
  chatSenderId,
  chatSenderName,
  isSelfMessage,
} from './ChatDock';

/**
 * 弹幕层：仅新消息右→左飘过，4~6 泳道，pointer-events:none。
 * 历史消息初始化时标记已读，不会一次性刷屏。
 */
export default function DanmakuLayer({
  messages = [],
  clientId = '',
  mutedIds = [],
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const seenRef = useRef(new Set());
  const bootedRef = useRef(false);
  const laneRef = useRef(0);
  const timersRef = useRef(new Set());
  const muteKey = useMemo(() => normalizeMutedIds(mutedIds).join('|'), [mutedIds]);

  useEffect(() => {
    const list = normalizeChatMessages(messages);
    if (!enabled || !bootedRef.current) {
      list.forEach(message => seenRef.current.add(message.id));
      bootedRef.current = true;
      if (!enabled) setItems([]);
      return;
    }
    const muted = new Set(normalizeMutedIds(mutedIds));
    const fresh = [];
    list.forEach(message => {
      if (seenRef.current.has(message.id)) return;
      seenRef.current.add(message.id);
      const senderId = chatSenderId(message);
      if (senderId && senderId !== String(clientId || '') && muted.has(senderId)) return;
      fresh.push(message);
    });
    if (fresh.length === 0) return;
    const next = fresh.map(message => ({
      ...message,
      lane: laneRef.current++ % 5,
      duration: 8 + Math.floor(Math.random() * 4),
    }));
    setItems(prev => [...prev, ...next].slice(-12));
    next.forEach(item => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setItems(prev => prev.filter(existing => existing.id !== item.id));
      }, item.duration * 1000 + 600);
      timersRef.current.add(timer);
    });
  }, [messages, enabled, clientId, muteKey]);

  useEffect(() => () => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  if (!enabled || items.length === 0) return null;

  return (
    <div className="danmaku-layer" aria-hidden="true">
      {items.map(item => (
        <div
          className={`danmaku-item ${isSelfMessage(item, clientId) ? 'self' : ''}`}
          key={item.id}
          style={{ '--lane': item.lane, animationDuration: `${item.duration}s` }}>
          <b>{chatSenderName(item)}</b>
          <span>{String(item.text || '').slice(0, CHAT_MAX_LENGTH)}</span>
        </div>
      ))}
    </div>
  );
}
