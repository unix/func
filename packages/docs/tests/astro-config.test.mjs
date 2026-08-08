import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('pre-bundles the Cloudflare passthrough image service for SSR', async () => {
  process.env.WRANGLER_WRITE_LOGS = '0'

  const { getViteConfig } = await import('astro/config')
  const root = fileURLToPath(new URL('../', import.meta.url))
  const createConfig = getViteConfig(
    { configFile: false },
    { logLevel: 'silent', root },
  )
  const viteConfig = await createConfig({
    command: 'serve',
    mode: 'development',
  })
  const environmentPlugin = viteConfig.plugins
    ?.flat(Infinity)
    .filter(Boolean)
    .find(plugin => plugin.name === '@astrojs/cloudflare:environment')

  assert.equal(typeof environmentPlugin?.configEnvironment, 'function')

  const ssrConfig = await environmentPlugin.configEnvironment('ssr', {
    optimizeDeps: { noDiscovery: false },
  })

  assert.ok(ssrConfig.optimizeDeps.include.includes('astro/assets/services/noop'))
})
