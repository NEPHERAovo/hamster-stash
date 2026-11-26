import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }).version;

function webdavDevProxyPlugin(): Plugin {
  return {
    name: 'webdav-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/webdav', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match, Lock-Token, Timeout, Destination, Overwrite, X-Target-URL, X-Requested-With, *',
          });
          res.end();
          return;
        }

        const targetUrl = (req.headers['x-target-url'] as string) || new URL(req.url || '', 'http://localhost').searchParams.get('url');
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing target URL in X-Target-URL header or ?url=' }));
          return;
        }

        try {
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (!['host', 'x-target-url', 'connection'].includes(k.toLowerCase()) && v) {
              headers.set(k, Array.isArray(v) ? v.join(', ') : (v as string));
            }
          }
          headers.set('Host', new URL(targetUrl).host);

          const chunks: Uint8Array[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const body = ['GET', 'HEAD'].includes(req.method || 'GET') || chunks.length === 0 ? undefined : Buffer.concat(chunks);

          const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
            redirect: 'follow',
          });

          const respHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            respHeaders[key] = value;
          });
          respHeaders['Access-Control-Allow-Origin'] = '*';
          respHeaders['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, Depth, If-Match, If-None-Match, Lock-Token, Timeout, Destination, Overwrite, X-Target-URL, X-Requested-With, *';
          respHeaders['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK';
          delete respHeaders['www-authenticate'];
          delete respHeaders['WWW-Authenticate'];

          res.writeHead(response.status, respHeaders);
          const resBuffer = await response.arrayBuffer();
          res.end(Buffer.from(resBuffer));
        } catch (e: unknown) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: true,
  },
  build: {
    target: ['safari16', 'ios16', 'chrome105', 'firefox105', 'es2022'],
    modulePreload: {
      resolveDependencies: (_url, deps) => {
        return deps.filter((dep) => !dep.includes('plugin-'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/plugins/')) {
            const match = id.match(/\/src\/plugins\/([^/]+)/);
            if (match && match[1]) {
              return `plugin-${match[1]}`;
            }
          }
          if (id.includes('node_modules')) {
            if (id.includes('@phosphor-icons/react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-framework';
            }
            if (id.includes('idb') || id.includes('zustand') || id.includes('dayjs') || id.includes('clsx')) {
              return 'vendor-core';
            }
          }
        },
      },
    },
  },
  plugins: [webdavDevProxyPlugin(), react(), tailwindcss(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: '仓鼠囤囤',
      short_name: '仓鼠囤囤',
      description: '集日常收支、物品收纳与资产管理于一体的轻量化个人账本',
      theme_color: '#ffffff',
      background_color: '#F3F4F6',
      display: 'standalone',
    },

    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    },

    devOptions: {
      enabled: false,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
})