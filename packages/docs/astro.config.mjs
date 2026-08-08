// @ts-check
import { fileURLToPath, URL } from 'node:url'
import cloudflare from '@astrojs/cloudflare'
import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import joinLine from 'astro-join-line'
import remarkJoinLine from 'astro-join-line/remark'
import { noImageEndpoint } from 'astro-no-image-endpoint/cloudflare'

/**
 * Keep each Astro command's Vite optimizer cache isolated.
 *
 * `astro check` implicitly runs `astro sync`, whose temporary Vite server can
 * replace the `deps_ssr` cache used by an active dev server. Separate cache
 * directories prevent sync/type generation from invalidating dev module URLs.
 *
 * @type {import('astro').AstroIntegration}
 */
const viteCacheIsolation = {
  name: 'vite-cache-isolation',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      updateConfig({
        vite: {
          cacheDir: fileURLToPath(
            new URL(`./node_modules/.vite/${command}/`, import.meta.url),
          ),
        },
      })
    },
  },
}

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
    viteCacheIsolation,
    mdx({
      processor: unified({
        remarkPlugins: [remarkJoinLine],
      }),
    }),
    joinLine(),
    noImageEndpoint(),
  ],
  vite: {
    optimizeDeps: {
      // The passthrough image service is resolved through a virtual module, so
      // Vite's source scan cannot discover it before Cloudflare imports the worker.
      include: ['astro/assets/services/noop'],
    },
    plugins: [tailwindcss()],
  },
})
