import config from '@unix/eslint'
import globals from 'globals'

export default [
  ...config,
  {
    ignores: [
      '**/.pnpm-store/**',
      '**/.build/**',
      '**/dist/**',
      '**/.vercel/**',
      '**/.wrangler/**',
      '**/.astro/**',
      '**/.github/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-use-before-define': [
        'error',
        { classes: true, functions: false, variables: false },
      ],
    },
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        { classes: true, enums: true, functions: false, variables: false },
      ],
      'no-undef': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      complexity: 'off',
      'func-style': 'off',
    },
  },
  {
    files: ['src/adapters/oclif-commands.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
]
