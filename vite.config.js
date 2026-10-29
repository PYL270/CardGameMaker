import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mobileBuildPlugin from './scripts/mobile-build-plugin.mjs';

export default defineConfig({
  // GitHub Pages 部署在 /CardGameMaker/ 子路径，用环境变量切换；本地与桌面版仍是根路径
  base: process.env.CG_BASE || '/',
  plugins: [react(), mobileBuildPlugin()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // 本地 APK 构建服务（server/build-apk.mjs，仅监听 127.0.0.1:8890）
      '/build-api': {
        target: 'http://127.0.0.1:8890',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/build-api/, ''),
      },
      // 本地 GPT-SoVITS API：前端统一请求 /voice-api/tts，由 Vite 转发到本机 9880，避免 CORS
      '/voice-api': {
        target: 'http://127.0.0.1:9880',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/voice-api/, ''),
      },
      // 本地 Piper 离线 TTS：前端统一请求 /piper-api/tts 与 /piper-api/health，转发到 9881
      '/piper-api': {
        target: 'http://127.0.0.1:9881',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piper-api/, ''),
      },
    },
    watch: {
      // 避免监听编辑器/测试产生的临时文件（Windows 下会触发 EBUSY 崩溃）
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/mobile/**',
        '**/android/**',
        '**/apk-out/**',
        '**/public/apk/**',
        '**/scripts/**',
        '**/*.tmp',
        '**/*.tmpdir',
        '**/*.tmpdir/**',
        '**/.*.tmpdir/**',
        '**/backup/**',
        '**/launcher.log',
        '**/test-*.png',
      ],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // 框架代码单独成块：应用迭代时 vendor 块哈希不变，浏览器可持续命中缓存
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
});
