import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from 'astro/markdown'

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url))

const getMarkdownFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) return getMarkdownFiles(file)
    return /\.mdx?$/.test(entry.name) ? [file] : []
  })

test('parses all Markdown frontmatter with Astro', () => {
  const errors = getMarkdownFiles(sourceDirectory)
    .sort()
    .flatMap(file => {
      try {
        parseFrontmatter(readFileSync(file, 'utf8'))
        return []
      } catch (error) {
        return [`${relative(sourceDirectory, file)}: ${String(error)}`]
      }
    })

  assert.deepEqual(errors, [])
})
