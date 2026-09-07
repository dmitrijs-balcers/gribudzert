import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const manifestPath = resolve(rootDir, 'dist/.vite/manifest.json');

type ViteManifestEntry = {
  readonly file: string;
  readonly css?: readonly string[];
};

type ViteManifest = Readonly<Record<string, ViteManifestEntry>>;

const readViteManifest = (): ViteManifest => {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing ${manifestPath}. Run "vite build" before "vite build --config vite.sw.config.ts".`
    );
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as ViteManifest;
};

const collectAssets = (manifest: ViteManifest): readonly string[] => {
  const paths = new Set<string>([
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/apple-touch-icon.png',
  ]);
  for (const entry of Object.values(manifest)) {
    paths.add(`/${entry.file}`);
    for (const css of entry.css ?? []) {
      paths.add(`/${css}`);
    }
  }
  return [...paths].sort();
};

const buildIdFrom = (assets: readonly string[]): string =>
  createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 16);

const manifest = readViteManifest();
const assets = collectAssets(manifest);
const buildId = buildIdFrom(assets);

export default defineConfig({
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: 'src/sw.ts',
      name: 'gribudzertServiceWorker',
      formats: ['iife'],
      fileName: () => 'sw.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    __SHELL_MANIFEST__: JSON.stringify(JSON.stringify({ buildId, assets })),
  },
});
