/**
 * CardGameMaker 桌面版主进程
 * - 内置静态服务器：把打包进 resources/web 的前端产物跑起来
 * - 内置联机中继：局域网联机、扫码加入（端口 8787，被占用时自动跳过）
 * - 单实例运行，二次启动只聚焦已有窗口
 */
import { app, BrowserWindow, shell, Menu, dialog } from 'electron';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRelay } from './relay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, 'web');
const WEB_PORT = Number(process.env.PORT || 3000);
const RELAY_PORT = Number(process.env.RELAY_PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

/** 启动本地静态服务器（单页应用回退到 index.html） */
function startWebServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(webRoot, path.normalize(urlPath).replace(/^([/\\])+/, ''));
      if (!file.startsWith(webRoot)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) file = path.join(webRoot, 'index.html');
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      fs.createReadStream(file).on('error', () => res.end()).pipe(res);
    });
    server.on('error', reject);
    server.listen(WEB_PORT, '127.0.0.1', () => resolve(server));
  });
}

let win = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#070b16',
    title: 'CardGameMaker · 卡牌游戏制作器',
    icon: path.join(here, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });

  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  // 外部链接交给系统浏览器，不在游戏窗口里跳走
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`http://127.0.0.1:${WEB_PORT}/`);
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startWebServer();
    } catch (err) {
      dialog.showErrorBox('启动失败', `本地服务端口 ${WEB_PORT} 启动失败：${err.message}`);
      app.quit();
      return;
    }
    try {
      const relay = startRelay(RELAY_PORT);
      relay.on('error', () => {
        // 端口被占用等情况：联机不可用，但单机对局照常
      });
    } catch {
      // 中继启动失败不影响单机对局
    }
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}
