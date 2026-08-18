import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import {
  analyzeStaticApplication,
  inspectStaticApplication,
} from '../src/plugins/static-application'
import { transformStaticApplicationSource } from '../src/plugins/application-precompile'
import { compileStaticApplication } from '../../core/src/subpath/precompiler'
import { describe, expect, test } from 'vitest'

const workspace = fileURLToPath(new URL('../../..', import.meta.url))

describe('analyzeStaticApplication', () => {
  test('precompiles the complete benchmark application graph', () => {
    const analysis = analyzeStaticApplication(
      path.join(workspace, 'benchmarks/src/adapters/func.ts'),
      path.join(workspace, 'benchmarks/tsconfig.json'),
    )

    if (!analysis) {
      const result = inspectStaticApplication(
        path.join(workspace, 'benchmarks/src/adapters/func.ts'),
        path.join(workspace, 'benchmarks/tsconfig.json'),
      )
      throw new TypeError(result.supported ? 'Expected analysis.' : result.reason)
    }
    expect(analysis).toBeDefined()
    expect(analysis.definition.modules).toHaveLength(4)
    expect(analysis.definition.modules.at(-1)).toMatchObject({
      handlers: [{ kind: 'command' }],
      name: 'AppModule',
      options: [{ kind: 'value' }, { kind: 'action' }],
    })
    expect(
      analysis.references.some(reference => reference.builtin === 'APP_FILTER'),
    ).toBe(true)
    const plan = compileStaticApplication(analysis.definition)
    const entry = path.join(workspace, 'benchmarks/src/adapters/func.ts')
    const transformed = transformStaticApplicationSource(
      fs.readFileSync(entry, 'utf8'),
      entry,
      analysis,
      plan,
    )

    expect(transformed).toContain('func/_internal/precompiled-v1')
    expect(transformed).toContain('__func_create_app_from_plan_v1(')
    expect(transformed).not.toContain('createApp(AppModule,')
  })

  test('precompiles a multi-file application', () => {
    const analysis = analyzeStaticApplication(
      path.join(workspace, 'examples/popular/src/index.ts'),
      path.join(workspace, 'examples/popular/tsconfig.json'),
    )

    expect(analysis).toBeDefined()
    if (!analysis) throw new TypeError('Expected a static popular application.')
    expect(analysis.definition.modules).toHaveLength(1)
    expect(new Set(analysis.references.map(reference => reference.file)).size).toBe(
      2,
    )
    const plan = compileStaticApplication(analysis.definition)
    const external = analysis.references.find(
      reference => reference.file !== analysis.entry,
    )
    if (!external) throw new TypeError('Expected a cross-file reference.')
    const externalSource = transformStaticApplicationSource(
      fs.readFileSync(external.file, 'utf8'),
      external.file,
      analysis,
      plan,
    )
    const entrySource = transformStaticApplicationSource(
      fs.readFileSync(analysis.entry, 'utf8'),
      analysis.entry,
      analysis,
      plan,
    )

    expect(externalSource).toContain('export const __func_precompiled_refs_v1_')
    expect(entrySource).toContain(`from ${JSON.stringify(external.file)}`)
  })

  test('falls back for dynamic module metadata', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'funcgo-static-application-'),
    )
    try {
      const entry = path.join(directory, 'index.ts')
      fs.writeFileSync(
        entry,
        [
          "import { Module, createApp } from 'func'",
          'const providers = process.env.PROVIDER ? [] : []',
          '@Module({ providers })',
          'class AppModule {}',
          'void createApp(AppModule).bootstrap()',
        ].join('\n'),
      )

      expect(analyzeStaticApplication(entry, true)).toBeUndefined()
    } finally {
      fs.rmSync(directory, { force: true, recursive: true })
    }
  })
})
