import { describe, expect, test } from 'vitest'
import { collectSetupSuggestions } from '../src/actions/setup'
import type { ProjectPackage } from '../src/utils/paths'

describe('collectSetupSuggestions', () => {
  test('suggests func-compatible defaults', () => {
    const pkg: ProjectPackage = {
      name: '@unix/demo',
    }
    const suggestions = collectSetupSuggestions(pkg, 'src/index.ts')

    suggestions.forEach(suggestion => suggestion.apply(pkg))

    expect(suggestions.map(item => item.message)).toEqual([
      'Add package.json#func.entry: "src/index.ts".',
      'Set package.json#func.outDir: "dist".',
      'Set package.json#bin.demo: "./dist/bin.js".',
      'Set package.json#scripts.dev: "funcgo dev --".',
      'Set package.json#scripts.build: "funcgo build".',
    ])
    expect(pkg.func).toEqual({
      entry: 'src/index.ts',
      outDir: 'dist',
    })
    expect(pkg.bin).toEqual({
      demo: './dist/bin.js',
    })
    expect(pkg.scripts).toEqual({
      dev: 'funcgo dev --',
      build: 'funcgo build',
    })
  })

  test('returns no suggestions when package already matches', () => {
    const pkg: ProjectPackage = {
      name: 'demo',
      bin: {
        demo: './dist/bin.js',
      },
      scripts: {
        dev: 'funcgo dev --',
        build: 'funcgo build',
      },
      func: {
        entry: 'src/index.ts',
        outDir: 'dist',
      },
    }

    expect(collectSetupSuggestions(pkg, 'src/index.ts')).toEqual([])
  })

  test('uses configured outDir for package bin', () => {
    const pkg: ProjectPackage = {
      name: 'demo',
      func: {
        entry: 'src/index.ts',
        outDir: 'build',
      },
    }
    const suggestions = collectSetupSuggestions(pkg, 'src/index.ts')

    suggestions.forEach(suggestion => suggestion.apply(pkg))

    expect(suggestions.map(item => item.message)).toEqual([
      'Set package.json#bin.demo: "./build/bin.js".',
      'Set package.json#scripts.dev: "funcgo dev --".',
      'Set package.json#scripts.build: "funcgo build".',
    ])
    expect(pkg.func).toEqual({
      entry: 'src/index.ts',
      outDir: 'build',
    })
    expect(pkg.bin).toEqual({
      demo: './build/bin.js',
    })
  })
})
