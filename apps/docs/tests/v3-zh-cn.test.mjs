import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const docsRoot = fileURLToPath(new URL('../', import.meta.url))
const chinesePagesRoot = join(docsRoot, 'src', 'pages', 'zh-cn')
const chineseErrorsRoot = join(docsRoot, 'src', 'content', 'errors', 'zh-cn')

const markdownFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(file)
    return entry.name.endsWith('.mdx') ? [file] : []
  })

test('keeps Chinese documentation on the v3 public API', () => {
  const files = [
    ...markdownFiles(chinesePagesRoot),
    ...markdownFiles(chineseErrorsRoot),
  ]
  const forbidden = [
    '@Service',
    '@Regs',
    'CommandRegistry',
    'services:',
    'createApp({ commands:',
  ]

  files.forEach(file => {
    const source = readFileSync(file, 'utf8')
    forbidden.forEach(value => {
      assert.equal(source.includes(value), false, `${file} still contains ${value}`)
    })
    commandDecorators(source).forEach(decorator => {
      assert.doesNotMatch(decorator, /\bname\s*:/, `${file} uses Command.name`)
    })
  })
})

test('documents every current system error in Chinese', () => {
  const errorsSource = readFileSync(
    join(docsRoot, '..', '..', 'packages', 'contracts', 'src', 'core-errors.ts'),
    'utf8',
  )
  const enumBody = /export enum SYSTEM \{([\s\S]*?)\n\}/.exec(errorsSource)?.[1]
  assert.ok(enumBody)
  const codes = Array.from(enumBody.matchAll(/^\s+([A-Z][A-Z0-9_]+)\s*=/gm))
    .map(match => `F_SYSTEM_${match[1]}.mdx`)
    .sort()
  const documented = readdirSync(chineseErrorsRoot)
    .filter(file => file.endsWith('.mdx'))
    .sort()

  assert.deepEqual(documented, codes)
})

test('lists every optional v3 package entry in the Chinese API reference', () => {
  const source = readFileSync(join(chinesePagesRoot, 'apis.mdx'), 'utf8')
  const entries = ['completion', 'config', 'help', 'log', 'signals', 'testing']

  entries.forEach(entry => {
    assert.match(source, new RegExp(`func/${entry}`))
  })
})

const commandDecorators = source => {
  const decorators = []
  let start = source.indexOf('@Command({')
  while (start >= 0) {
    const end = source.indexOf('})', start)
    decorators.push(source.slice(start, end < 0 ? source.length : end + 2))
    start = source.indexOf('@Command({', start + 1)
  }
  return decorators
}
