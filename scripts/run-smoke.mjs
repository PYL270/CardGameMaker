/**
 * 用 Vite 的 SSR 构建把冒烟测试打包成单文件，再在 Node 中运行
 * 用途: 无浏览器环境下验证游戏引擎逻辑
 */
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const outDir = resolve('scripts/.smoke');
const entry = resolve('scripts/smoke-test.mjs');

await build({
  configFile: false,
  logLevel: 'error',
  build: {
    ssr: true,
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: entry,
      output: {
        format: 'es',
        entryFileNames: 'smoke.mjs',
      },
    },
  },
});

await import(pathToFileURL(resolve(outDir, 'smoke.mjs')).href);
