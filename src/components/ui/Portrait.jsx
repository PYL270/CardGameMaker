import React, { useState } from 'react';
import { isSafeImageUrl } from '../../ai/artProviders';

/**
 * 武将头像/立绘：有安全 imageUrl 时用 <img> object-fit:cover，否则回退名字首字。
 * 加载失败自动回退首字；data:image 与 http(s) 均可，拒绝 javascript: 等协议。
 */
export default function Portrait({ src = '', name = '', className = '', size = null, style = null, alt = '' }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = !failed && isSafeImageUrl(src) ? src : '';
  const initial = (String(name || '').trim().charAt(0)) || '?';
  const sizeStyle = size ? { width: size, height: size } : null;
  return (
    <span className={`portrait ${safeSrc ? 'has-image' : 'no-image'} ${className}`.trim()}
      style={{ ...(sizeStyle || {}), ...(style || {}) }}>
      {safeSrc
        ? (
          <img
            src={safeSrc}
            alt={alt || (name ? `${name}的立绘` : '武将立绘')}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )
        : <span className="portrait-initial" aria-hidden="true">{initial}</span>}
    </span>
  );
}
