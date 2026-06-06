// @ts-check

import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { joinLine } from './src/lib/astroJoinLine.mjs'

// https://astro.build/config
export default defineConfig({
  prefetch: {
    prefetchAll: true,
  },
  i18n: {
    locales: ['en', 'zh-cn'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  output: 'static',
  integrations: [react(), joinLine()],
  vite: {
    plugins: [tailwindcss()],
  },
})
