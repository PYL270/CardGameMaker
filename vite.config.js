import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mobileBuildPlugin from './scripts/mobile-build-plugin.mjs';

export default defineConfig({
  plugins: [react(), mobileBuildPlugin()],
  server: {
    port: 3000,
    open: true,
    proxy: {
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
  },
});
