import React from 'react';

/**
 * 统一线性图标（24 viewBox / stroke 1.6 / round caps / currentColor）。
 * - 尺寸通过 size 控制，颜色跟随 currentColor
 * - className 会附加在 `ui-icon ui-icon--<name>` 之后，便于做 chevron/refresh 微交互
 */

export const ICON_NAMES = [
  // 既有
  'sword', 'network', 'editor', 'code', 'settings', 'music', 'image', 'book',
  'log', 'layout', 'refresh', 'exit', 'auto', 'clock',
  // 通用 UI
  'close', 'chevron-down', 'chevron-right', 'plus', 'minus', 'trash', 'upload',
  'check', 'alert', 'hand', 'team', 'shield', 'heart', 'ruler', 'sort', 'shuffle',
  'trophy', 'play', 'pause', 'user', 'home', 'arrow-left', 'arrow-right',
  'eye', 'eye-off', 'volume', 'search', 'link', 'download', 'sparkle', 'package',
  // 语音 / 绘画
  'mic', 'voice', 'palette', 'stop',
  // 联机聊天
  'chat',
];

export default function Icon({ name, size = 18, className = '' }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `ui-icon ui-icon--${name} ${className}`.trim(),
    'data-icon': name,
    'aria-hidden': true,
  };

  switch (name) {
    case 'sword':
      return (
        <svg {...common}>
          <path d="M13.6 3.4h7v7l-9.9 9.9-7-7z" fill="currentColor" fillOpacity="0.12" />
          <path d="M13.6 3.4h7v7M10.8 10.2l3 3M8.2 17.2l-3.6 3.4M4.4 16.8l3 3" />
          <circle cx="4.4" cy="20" r="1.1" fill="currentColor" fillOpacity="0.16" />
        </svg>
      );
    case 'network':
      return (
        <svg {...common}>
          <circle cx="12" cy="4.8" r="2.1" fill="currentColor" fillOpacity="0.12" />
          <circle cx="5" cy="18.6" r="2.1" fill="currentColor" fillOpacity="0.12" />
          <circle cx="19" cy="18.6" r="2.1" fill="currentColor" fillOpacity="0.12" />
          <path d="M10.6 6.6L6.3 16.6M13.4 6.6l4.3 10M7.2 18.6h9.6M12 7v4.4M9.8 14.6h4.4" />
          <circle cx="12" cy="12.4" r="1.1" fill="currentColor" fillOpacity="0.16" />
        </svg>
      );
    case 'editor':
      return (
        <svg {...common}>
          <path d="M5.5 3.8h8.7L18.8 8.3v12H5.5z" fill="currentColor" fillOpacity="0.10" />
          <path d="M14.2 3.8v4.5h4.6M8.6 11.2h6M8.6 14.2h6M8.6 17.2h3.6" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d="M8.8 7.8L4.4 12l4.4 4.2M15.2 7.8L19.6 12l-4.4 4.2" />
          <path d="M13.4 5.6l-2.8 12.8M5.8 19.6h12.4" opacity="0.55" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 3.1l1.7 2.1 2.6-.6.8 2.6 2.5 1.1-.8 2.5.8 2.5-2.5 1.1-.8 2.6-2.6-.6L12 20.9l-1.7-2.1-2.6.6-.8-2.6-2.5-1.1.8-2.5-.8-2.5 2.5-1.1.8-2.6 2.6.6z"
            fill="currentColor" fillOpacity="0.10" />
          <circle cx="12" cy="12" r="3.2" fill="currentColor" fillOpacity="0.16" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <path d="M9 17.6V6.4l8-2.2v10.4" />
          <ellipse cx="6.4" cy="17.8" rx="2.6" ry="1.9" fill="currentColor" fillOpacity="0.12" />
          <ellipse cx="14.4" cy="15.6" rx="2.4" ry="1.8" fill="currentColor" fillOpacity="0.12" />
          <path d="M9 9.1l8-2.2" opacity="0.7" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" fill="currentColor" fillOpacity="0.07" />
          <circle cx="8.9" cy="9.7" r="1.7" fill="currentColor" fillOpacity="0.15" />
          <path d="M4.5 17.4l4.8-4.8 3 3 2.4-2.4 4.8 4.8" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M12 6.2C10.2 5 7.6 4.6 4.5 5.2v13.2c3.1-.6 5.7-.2 7.5 1 1.8-1.2 4.4-1.6 7.5-1V5.2c-3.1-.6-5.7-.2-7.5 1z"
            fill="currentColor" fillOpacity="0.11" />
          <path d="M12 6.2v13.2M7 9.2h2.8M7 12.2h2.8M14.2 9.2H17M14.2 12.2H17" />
        </svg>
      );
    case 'layout':
      return (
        <svg {...common}>
          <rect x="3.5" y="4" width="17" height="16" rx="2.2" />
          <path d="M3.5 9h17M9.5 9v11" />
          <rect x="12" y="12" width="5.5" height="4.5" rx="1" fill="currentColor" fillOpacity="0.12" />
          <path d="M5.5 12h2M5.5 15h2" />
        </svg>
      );
    case 'log':
      return (
        <svg {...common}>
          <path d="M5 4.5h14v15H5zM8.5 9h7M8.5 12.5h7M8.5 16h4" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common}>
          <path d="M4.5 5.5h15v10.2h-8.4L6.8 19v-3.3H4.5z" />
          <path d="M8.2 9h7.6M8.2 12.2h5.2" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M19 12a7 7 0 1 0-2 5" />
        </svg>
      );
    case 'exit':
      return (
        <svg {...common}>
          <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
        </svg>
      );
    case 'auto':
    case 'play':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M10 8.5l6 3.5-6 3.5z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M10 8.5v7M14 8.5v7" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5V12l3.2 2" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V5M8.5 8.5L12 5l3.5 3.5" />
          <path d="M4.5 19h15" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 5v11M8.5 12.5L12 16l3.5-3.5" />
          <path d="M4.5 19h15" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 4.5L21 20H3z" />
          <path d="M12 10v4.5M12 17.2v.1" />
        </svg>
      );
    case 'hand':
      return (
        <svg {...common}>
          <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v6M14 11V7a1.5 1.5 0 0 1 3 0v7.5c0 3.3-2.2 5.5-5.5 5.5S7 17.8 7 14.5V11" />
        </svg>
      );
    case 'team':
      return (
        <svg {...common}>
          <circle cx="8.5" cy="9" r="2.4" />
          <circle cx="16" cy="10" r="2" />
          <path d="M3.5 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M13.6 18.6c.2-2.3 1.8-3.9 4-3.9 1.8 0 3.2 1.2 3.6 3" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.2l7.2 2.7v5.6c0 4.4-2.9 7.6-7.2 9.3-4.3-1.7-7.2-4.9-7.2-9.3V5.9z"
            fill="currentColor" fillOpacity="0.13" />
          <path d="M12 3.2v17.6M9 12l2.2 2.2L15.5 9.8" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 20.2s-7.4-4.6-7.4-9.6C4.6 7.9 6.7 6 9.2 6c1.2 0 2.2.5 2.8 1.4C12.6 6.5 13.6 6 14.8 6c2.5 0 4.6 1.9 4.6 4.6 0 5-7.4 9.6-7.4 9.6z"
            fill="currentColor" fillOpacity="0.15" />
          <path d="M8.4 9.4c.4-.8 1.1-1.2 2-1.2" opacity="0.65" />
        </svg>
      );
    case 'ruler':
      return (
        <svg {...common}>
          <path d="M3.5 15.5L15.5 3.5l5 5-12 12z" />
          <path d="M7 12l2 2M10 9l2 2M13 6l2 2" />
        </svg>
      );
    case 'sort':
      return (
        <svg {...common}>
          <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
        </svg>
      );
    case 'shuffle':
      return (
        <svg {...common}>
          <path d="M4 7h3.5c2 0 3.2 1 4.5 2.5M20 7h-3.5c-2 0-3.2 1-4.5 2.5M4 17h3.5c2 0 3.2-1 4.5-2.5M20 17h-3.5c-2 0-3.2-1-4.5-2.5" />
          <path d="M17 4l3 3-3 3M17 14l3 3-3 3" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 3.8h8v5.2a4 4 0 0 1-8 0z" fill="currentColor" fillOpacity="0.14" />
          <path d="M8 5.8H4.5c0 2.8 1.5 4.3 3.7 4.3M16 5.8h3.5c0 2.8-1.5 4.3-3.7 4.3M12 13v4M8.5 20.2h7l-.8-3.2h-5.4z" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20c0-3.4 3-5.6 7-5.6s7 2.2 7 5.6" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5.5h4V20" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...common}>
          <path d="M4 4l16 16" />
          <path d="M9.6 5.9A9.8 9.8 0 0 1 12 5.6c6 0 9.2 6.4 9.2 6.4a15 15 0 0 1-3 3.6M6.4 7.2A15.5 15.5 0 0 0 2.8 12s3.2 6.2 9.2 6.2c1.5 0 2.8-.4 3.9-1" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3.2" width="6" height="11" rx="3" fill="currentColor" fillOpacity="0.14" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6M10.8 7.2h2.4M10.8 10h2.4" />
        </svg>
      );
    case 'voice':
      return (
        <svg {...common}>
          <path d="M4 12v1M8 8v8M12 5v14M16 7v10M20 10v4" />
        </svg>
      );
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.6 0 2.2-.9 2.2-1.9 0-1.3-1.1-1.8-1.1-3 0-1 .8-1.7 1.8-1.7h2.3c1.8 0 3.3-1.4 3.3-3.2C20.5 6.8 16.7 3.5 12 3.5z"
            fill="currentColor" fillOpacity="0.12" />
          <circle cx="7.7" cy="10.2" r="1" fill="currentColor" fillOpacity="0.16" />
          <circle cx="10.3" cy="7.4" r="1" fill="currentColor" fillOpacity="0.16" />
          <circle cx="14.4" cy="7.6" r="1" fill="currentColor" fillOpacity="0.16" />
        </svg>
      );
    case 'stop':
      return (
        <svg {...common}>
          <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        </svg>
      );
    case 'volume':
      return (
        <svg {...common}>
          <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
          <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z" />
          <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5z" />
          <path d="M4 7.5L12 11l8-3.5M12 11v9M8 5.6l8 3.5" />
        </svg>
      );
    default:
      return null;
  }
}
