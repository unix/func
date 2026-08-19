import fs from 'fs'
import path from 'path'
import { expect, test } from 'vitest'

interface ExportEntry {
  import?: unknown
  require?: unknown
}

test('exposes ESM entries to CommonJS callers without a second build', () => {
  const metadata: unknown = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
  )
  if (!isRecord(metadata) || !isRecord(metadata.exports)) {
    throw new TypeError('Expected package exports.')
  }

  Object.entries(metadata.exports).forEach(([name, value]) => {
    if (!isExportEntry(value) || typeof value.import !== 'string') return
    expect(typeof value.require, `${name} should support require`).toBe('string')
    if (name === './parser') return
    expect(value.require, `${name} should reuse its ESM implementation`).toBe(
      value.import,
    )
  })
})

const isExportEntry = (value: unknown): value is ExportEntry => {
  return typeof value === 'object' && value !== null
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}
