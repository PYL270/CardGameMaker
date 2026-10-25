import React from 'react';
import { isMobileDevice, MOBILE_LIMITATIONS } from '../../utils/mobile';

/**
 * 手机版能力提示：桌面端不渲染；手机 App/手机浏览器显示“电脑专属功能”清单。
 * forceMobile 仅供 SSR 测试/预览使用。
 */
export default function MobileNotice({ forceMobile = null, compact = false }) {
  const mobile = forceMobile === null ? isMobileDevice() : !!forceMobile;
  if (!mobile) return null;
  return (
    <div className={`mobile-capability-notice ${compact ? 'compact' : ''}`} role="note">
      <div className="mobile-notice-head">
        <span className="mobile-version-badge">手机版</span>
        <strong>电脑专属功能提示</strong>
      </div>
      <p className="mobile-notice-summary">
        浏览器语音、对局、武将编辑在手机可用；以下功能需要电脑端配合：
      </p>
      <ul className="mobile-limit-list">
        {MOBILE_LIMITATIONS.map(item => (
          <li key={item.id}>
            <b>{item.label}</b>
            <span>{item.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
