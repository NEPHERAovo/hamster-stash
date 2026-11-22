import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import tailwind from 'eslint-plugin-tailwindcss';

const localUiPlugin = {
  rules: {
    'prefer-standard-ui': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce standard UI components instead of raw HTML elements',
        },
        messages: {
          avoidRawButton: 'Avoid raw <button>. Use PaperButton, PaperIconButton, PaperChip or SegToggle from UI library instead.',
          avoidRawSelect: 'Avoid raw <select>. Use PaperSelect from UI library instead.',
          avoidRawInput: 'Avoid raw <input>. Use PaperInput or AmountInput from UI library instead.',
        },
      },
      create(context) {
        const filePath = (context.filename || (context.getFilename && context.getFilename()) || '').replace(/\\/g, '/');
        if (
          filePath.includes('/components/ui/') ||
          filePath.includes('/tests/') ||
          filePath.includes('/components/layout/PaperBottomNav.tsx') ||
          filePath.includes('/components/layout/ModernBottomNav.tsx') ||
          filePath.includes('/components/ledger/TransactionKeypad.tsx')
        ) {
          return {};
        }

        return {
          JSXOpeningElement(node) {
            if (node.name.type !== 'JSXIdentifier') return;
            const tag = node.name.name;

            if (tag === 'button') {
              context.report({ node, messageId: 'avoidRawButton' });
            } else if (tag === 'select') {
              context.report({ node, messageId: 'avoidRawSelect' });
            } else if (tag === 'input') {
              const isFileInput = node.attributes.some(
                (attr) =>
                  attr.type === 'JSXAttribute' &&
                  attr.name?.name === 'type' &&
                  attr.value?.value === 'file'
              );
              if (!isFileInput) {
                context.report({ node, messageId: 'avoidRawInput' });
              }
            }
          },
        };
      },
    },
  },
};

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
      'local-ui': localUiPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-nested-ternary': 'error',
      'tailwindcss/no-contradicting-classname': 'error',
      'tailwindcss/enforces-shorthand': 'error',
      'tailwindcss/enforces-canonical-classname': 'off',
      'tailwindcss/no-unnecessary-arbitrary-value': 'error',
      'tailwindcss/classnames-order': 'error',
      'tailwindcss/no-custom-classname': 'off',
      'local-ui/prefer-standard-ui': 'error',
    },
    settings: {
      tailwindcss: {
        cssConfigPath: 'src/index.css',
        callees: ['classnames', 'clsx', 'ctl', 'cn'],
      },
    },
  },
  {
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
