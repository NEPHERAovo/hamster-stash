import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function phosphorWeightPruner(): Plugin {
  return {
    name: 'phosphor-weight-pruner',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.includes('@phosphor-icons/react') && normalizedId.includes('/defs/')) {
        let reg: string | null = null;
        let duo: string | null = null;
        const entryRe = /\[\s*"([a-zA-Z0-9]+)"\s*,\s*([\s\S]*?)\](?=\s*,\s*\[|\s*\]\s*\);)/g;
        let m: RegExpExecArray | null;
        while ((m = entryRe.exec(code)) !== null) {
          if (m[1] === 'regular') reg = m[2];
          if (m[1] === 'duotone') duo = m[2];
        }
        if (!reg && !duo) return null;
        if (!reg) reg = duo;
        if (!duo) duo = reg;
        return {
          code: `import * as e from "react";\nconst _r = ${reg};\nconst _d = ${duo};\nconst a = /* @__PURE__ */ new Map([\n  ["regular", _r],\n  ["duotone", _d],\n  ["bold", _r],\n  ["fill", _d],\n  ["light", _r],\n  ["thin", _r]\n]);\nexport { a as default };\n`,
          map: null,
        };
      }
      return null;
    },
  };
}

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
  plugins: [phosphorWeightPruner(), react(), tailwindcss(), VitePWA({
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