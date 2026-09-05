import { defineConfig, loadEnv, type Plugin } from 'vite';

const UMAMI_TAG = /[ \t]*<script[^>]*data-analytics="umami"[^>]*>\s*<\/script>\s*\n?/;
const UMAMI_ID_PLACEHOLDER = '%VITE_UMAMI_WEBSITE_ID%';

/**
 * Emits the Umami <script data-analytics="umami"> tag from index.html only for
 * production builds, so local dev / preview traffic never reaches analytics.
 */
function umamiAnalytics(mode: string, websiteId: string): Plugin {
  const enabled = mode === 'production' && websiteId.length > 0;
  return {
    name: 'gribudzert:umami-analytics',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return enabled
          ? html.replace(UMAMI_ID_PLACEHOLDER, websiteId)
          : html.replace(UMAMI_TAG, '');
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = decodeURIComponent(new URL('.', import.meta.url).pathname);
  const env = loadEnv(mode, envDir, 'VITE_');
  return {
    plugins: [umamiAnalytics(mode, env.VITE_UMAMI_WEBSITE_ID ?? '')],
  };
});
