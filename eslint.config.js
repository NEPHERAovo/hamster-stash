import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import tailwind from 'eslint-plugin-tailwindcss';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.agents']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      tailwindcss: tailwind,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Complexity and code smell prevention
      'no-nested-ternary': 'error',

      // Tailwind CSS rules tailored for Tailwind v4 and clean styling
      'tailwindcss/no-contradicting-classname': 'error',
      'tailwindcss/enforces-shorthand': 'warn',
      'tailwindcss/enforces-canonical-classname': 'off', // Preserves dynamic theme tokens like rounded-(--radius-md)
      'tailwindcss/no-unnecessary-arbitrary-value': 'warn',
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'off',
    },
    settings: {
      tailwindcss: {
        cssConfigPath: 'src/index.css',
        callees: ['classnames', 'clsx', 'ctl', 'cn'],
      },
    },
  },
  {
    // Strict Plugin SDK isolation: plugins must only import from plugin-sdk or internal siblings
    files: ['src/plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../../stores/**',
                '../../core/**',
                '../../domain/**',
                '../../components/**',
                '../../../stores/**',
                '../../../core/**',
                '../../../domain/**',
                '../../../components/**',
                '../../../../stores/**',
                '../../../../core/**',
                '../../../../domain/**',
                '../../../../components/**',
                '@/stores/**',
                '@/core/**',
                '@/domain/**',
                '@/components/**',
                'src/stores/**',
                'src/core/**',
                'src/domain/**',
                'src/components/**',
              ],
              message:
                'Strict Plugin SDK Isolation: Code in src/plugins/** must only import from src/plugin-sdk (or relative sibling paths within its own directory). Direct imports to stores, core, domain, or components are strictly banned.',
            },
          ],
        },
      ],
    },
  },
]);
