/**
 * 打包并运行联机房主端集成测试（store 使用 ESM 无扩展名导入，需 Vite 打包）
 */
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const outDir = resolve('scripts/.smoke-online');
await build({
  configFile: false,
  logLevel: 'error',
  build: {
    ssr: true,
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: resolve('scripts/online-host-smoke.mjs'),
      output: { format: 'es', entryFileNames: 'online-host.mjs' },
    },
  },
});
await import(pathToFileURL(resolve(outDir, 'online-host.mjs')).href);
