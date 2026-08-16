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
      'benchmarks/**',
      'ecosystem-tests/**',
      'examples/**',
      'templates/**',
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
    files: ['packages/core/e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './packages/core/e2e/tsconfig.eslint.json',
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
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
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-use-before-define': [
        'error',
        { classes: true, enums: true, functions: false, variables: false },
      ],
      'no-undef': 'off',
    },
  },
]
