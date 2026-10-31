import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA：仅生产环境的网页版注册 Service Worker。
// APK / Capacitor 自带本地服务器与横屏配置，不需要（也不应该）走 SW。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const isNativeShell =
    window.__CGM_MOBILE__ || window.Capacitor || /CGMAndroid/i.test(navigator.userAgent);
  if (!isNativeShell) {
    const base = import.meta.env.BASE_URL || '/';
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${base}sw.js`, { scope: base })
        .catch(() => {
          // http 环境或浏览器不支持时静默失败，不影响游戏
        });
    });
  }
}
