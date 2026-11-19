import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
  },
  build: {
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
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-framework';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('idb') || id.includes('zustand') || id.includes('dayjs') || id.includes('clsx')) {
              return 'vendor-core';
            }
          }
        },
      },
    },
  },
  plugins: [react(), tailwindcss(), VitePWA({
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