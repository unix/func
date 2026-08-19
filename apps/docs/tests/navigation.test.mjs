import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const docsRoot = fileURLToPath(new URL('../', import.meta.url))
const docsSource = readFileSync(join(docsRoot, 'src', 'lib', 'docs.ts'), 'utf8')
const docsJavaScript = ts.transpileModule(docsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const { getLanguageSwitch, getNavGroups } = await import(
  `data:text/javascript;base64,${Buffer.from(docsJavaScript).toString('base64')}`
)
const extensionPages = readdirSync(join(docsRoot, 'src', 'pages', 'extensions'))
  .filter(file => file.endsWith('.mdx'))
  .map(file => `extensions/${file.slice(0, -4)}`)
  .sort()

test('lists every extension page in each locale navigation', () => {
  for (const locale of ['en', 'zh-cn']) {
    const navigationPages = getNavGroups(locale)
      .flatMap(group => group.items)
      .map(item => item.id)
      .filter(page => page.startsWith('extensions/'))
      .sort()

    assert.deepEqual(navigationPages, extensionPages)
  }
})

test('switches extension pages directly between locales', () => {
  for (const page of extensionPages) {
    assert.equal(getLanguageSwitch(page, 'en').href, `/zh-cn/${page}`)
    assert.equal(getLanguageSwitch(page, 'zh-cn').href, `/${page}`)
  }
})
