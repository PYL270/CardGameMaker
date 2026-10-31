/* CardGameMaker service worker
 * 目标：让网页版可以「安装到桌面」并以 standalone + 横屏运行，同时缓存外壳与静态资源。
 * 策略：
 *   - 导航请求：network-first，失败回落缓存的 index.html
 *   - /assets/ 与图标：cache-first（文件名带 hash，可长期缓存）
 *   - /audio/：完全不拦截（音频体积大，交给浏览器 HTTP 缓存）
 */
const VERSION = 'cgm-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 音频不缓存，避免占满配额
  if (url.pathname.includes('/audio/')) return;
  // 构建接口、语音接口等动态请求不缓存
  if (/\/(build-api|voice-api|piper-api)\//.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match(request)))
    );
    return;
  }

  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
      )
    );
  }
});
