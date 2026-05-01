import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
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
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Custom rule: data-* attributes must come BEFORE /> or >
      'react/jsx-closing-bracket-location': 'error',
      // Prevent data-* after self-closing tag
      'react/jsx-tag-spacing': ['error', {
        closingSlash: 'never',
        beforeSelfClose: 'always',
        afterOpening: 'never',
        beforeClosing: 'never',
      }],
      // Enforce data-* attributes placement
      'react/self-closing-comp': ['error', {
        component: true,
        html: true,
      }],
    },
    settings: {
      react: {
        version: 'detect',
      },
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
    ignores: ['node_modules/**', 'dist/**', '.git/**', '*.config.js'],
  },
];
