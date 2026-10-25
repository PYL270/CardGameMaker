/**
 * 用 Vite SSR 构建打包 UI 冒烟测试并运行
 */
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const outDir = resolve('scripts/.smoke-ui');
const entry = resolve('scripts/ui-smoke.mjs');

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
        entryFileNames: 'ui-smoke.mjs',
      },
    },
  },
});

await import(pathToFileURL(resolve(outDir, 'ui-smoke.mjs')).href);
