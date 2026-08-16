import config from '@unix/eslint/js'
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
]
