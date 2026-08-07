// @ts-check
import cloudflare from '@astrojs/cloudflare'
import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import joinLine from 'astro-join-line'
import remarkJoinLine from 'astro-join-line/remark'
import { noImageEndpoint } from 'astro-no-image-endpoint/cloudflare'

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  devToolbar: {
    enabled: false,
  },
  prefetch: {
    defaultStrategy: 'viewport',
  },
  session: false,
  i18n: {
    locales: ['en', 'zh-cn'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  trailingSlash: 'never',
  output: 'static',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  integrations: [
    mdx({
      processor: unified({
        remarkPlugins: [remarkJoinLine],
      }),
    }),
    joinLine(),
    noImageEndpoint(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
