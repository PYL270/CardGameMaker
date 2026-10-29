import React, { memo, useState } from 'react';
import useGameStore from '../../store/gameStore';
import Icon from '../ui/Icon';
import ChatDock, { loadDanmakuEnabled, saveDanmakuEnabled, normalizeMutedIds } from './ChatDock';
import DanmakuLayer from './DanmakuLayer';

/**
 * 局内聊天层：聊天消息/静音列表/客户端 id 等高频变化的状态都在此订阅，
 * 新消息只重渲染本层，不再带动整个 GameBoard 重渲染。
 */
function ChatLayer({ online, isSpectator, chatOpen, onCloseChat }) {
  const chatMessages = useGameStore(s => s.online.chatMessages);
  const chatMuted = useGameStore(s => s.chatMuted || s.online.chatMuted);
  const chatClientId = useGameStore(s => s.online.clientId);
  const sendChat = useGameStore(s => s.sendChat);
  const toggleChatMute = useGameStore(s => s.toggleChatMute);
  const markChatRead = useGameStore(s => s.markChatRead);
  const [danmakuEnabled, setDanmakuEnabled] = useState(() => loadDanmakuEnabled());

  const mutedChatIds = normalizeMutedIds(chatMuted);
  if (!online?.active) return null;
  return (
    <>
      <DanmakuLayer
        messages={chatMessages || []}
        clientId={chatClientId || online.clientId || ''}
        mutedIds={mutedChatIds}
        enabled={danmakuEnabled}
      />
      <ChatDock
        open={chatOpen}
        onClose={onCloseChat}
        roomCode={online.roomCode || ''}
        messages={chatMessages || []}
        clientId={chatClientId || online.clientId || ''}
        mutedIds={mutedChatIds}
        onToggleMute={id => toggleChatMute?.(id)}
        onMarkRead={() => markChatRead?.()}
        onSend={typeof sendChat === 'function' ? text => sendChat(text) : undefined}
        connected={!!online.connected}
        spectator={isSpectator}
        danmakuEnabled={danmakuEnabled}
        onToggleDanmaku={next => {
          setDanmakuEnabled(next);
          saveDanmakuEnabled(next);
        }}
      />
    </>
  );
}
export default memo(ChatLayer);

/**
 * 顶栏聊天按钮：未读数独立订阅，消息刷屏时只有这个小组件重渲染。
 */
export function ChatToggleButton({ chatOpen, onToggle }) {
  const chatUnread = useGameStore(s => s.online.chatUnread);
  const markChatRead = useGameStore(s => s.markChatRead);
  const unreadChat = Math.max(0, Number(chatUnread) || 0);
  return (
    <button
      className={`btn btn-small header-action chat-toggle ${chatOpen ? 'btn-primary' : ''}`}
      title="局内聊天"
      onClick={() => {
        onToggle();
        if (!chatOpen) markChatRead?.();
      }}>
      <Icon name="chat" size={15} />
      <span className="btn-label">聊天</span>
      {unreadChat > 0 && (
        <span className="chat-unread-badge">{unreadChat > 99 ? '99+' : unreadChat}</span>
      )}
    </button>
  );
}
