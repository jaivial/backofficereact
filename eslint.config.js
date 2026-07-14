import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript compiler handles unused type bindings and globals more accurately.
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // React Compiler rules are not compatible with current Vike data functions and stories.
      'no-useless-assignment': 'off',
      'no-case-declarations': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    // Custom rule: prevent data-* after self-closing tag
    name: 'custom/data-attr-placement',
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name=/^data-/][parent.key.value=/^[^"]*\\/[^"]*$/]',
          message: 'data-* attributes must come BEFORE the closing />. Found: "/data-..." after self-close.',
        },
      ],
    },
  },
  {
    // Ignore node_modules and build directories
    ignores: ['node_modules/**', 'dist/**', '.git/**', '*.config.js', '**/*.stories.ts', '**/*.stories.tsx'],
  },
];
