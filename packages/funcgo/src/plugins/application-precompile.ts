import { pathToFileURL } from 'node:url'
import type { Plugin } from 'rolldown'
import {
  inspectStaticApplication,
  type StaticApplicationAnalysis,
} from './static-application'

interface ApplicationPrecompileOptions {
  entry: string
  mode: 'auto' | 'required' | false
  tsconfig: string | true
}

interface PrecompilerModule {
  compileStaticApplication(definition: unknown): unknown
}

interface CompiledApplication {
  accessors: readonly string[]
  aliases: ReadonlyMap<string, string>
  analysis: StaticApplicationAnalysis
  plan: unknown
  referencesByFile: ReadonlyMap<string, readonly string[]>
}

const PRECOMPILED_RUNTIME = 'func/_internal/precompiled-v1'
const PRECOMPILER = 'func/_internal/precompiler-v1'
const CREATE_APP = '__func_create_app_from_plan_v1'

export const applicationPrecompilePlugin = (
  options: ApplicationPrecompileOptions,
): Plugin => {
  let compiled: CompiledApplication | undefined

  return {
    name: 'funcgo-application-precompile',
    async buildStart() {
      if (options.mode === false) return
      const runtime = await this.resolve(PRECOMPILED_RUNTIME, options.entry, {
        skipSelf: true,
      })
      const precompiler = await this.resolve(PRECOMPILER, options.entry, {
        skipSelf: true,
      })
      if (!runtime || runtime.external || !precompiler || precompiler.external) {
        if (options.mode === 'required') {
          this.error(
            'The installed func version does not support application precompilation.',
          )
        }
        return
      }
      const result = inspectStaticApplication(options.entry, options.tsconfig)
      if (!result.supported) {
        if (options.mode === 'required') {
          this.error(
            `The application graph cannot be precompiled: ${result.reason}.`,
          )
        }
        return
      }
      const analysis = result.analysis

      try {
        const module: unknown = await import(pathToFileURL(precompiler.id).href)
        if (!isPrecompilerModule(module)) return
        const plan = module.compileStaticApplication(analysis.definition)
        compiled = prepareApplication(analysis, plan)
      } catch (error) {
        compiled = undefined
        if (options.mode === 'required') {
          this.error(
            error instanceof Error
              ? `Application precompilation failed: ${error.message}`
              : 'Application precompilation failed.',
          )
        }
      }
    },
    transform(code, id) {
      if (!compiled) return
      return transformCompiledSource(code, id, compiled)
    },
  }
}

export const transformStaticApplicationSource = (
  code: string,
  id: string,
  analysis: StaticApplicationAnalysis,
  plan: unknown,
): string | undefined =>
  transformCompiledSource(code, id, prepareApplication(analysis, plan))

const transformCompiledSource = (
  code: string,
  id: string,
  compiled: CompiledApplication,
): string | undefined => {
  const file = normalizeId(id)
  const references = compiled.referencesByFile.get(file)
  if (file === compiled.analysis.entry) return transformEntry(code, compiled)
  if (!references?.length) return undefined
  const alias = compiled.aliases.get(file)
  if (!alias) return undefined
  return `${code}\nexport const ${alias} = [${references.join(',')}];\n`
}

const prepareApplication = (
  analysis: StaticApplicationAnalysis,
  plan: unknown,
): CompiledApplication => {
  const grouped = new Map<string, string[]>()
  const positions = new Map<number, { file: string; index: number }>()
  analysis.references.forEach(reference => {
    const values = grouped.get(reference.file) ?? []
    positions.set(reference.id, { file: reference.file, index: values.length })
    values.push(reference.code)
    grouped.set(reference.file, values)
  })
  const aliases = new Map<string, string>()
  Array.from(grouped.keys())
    .sort()
    .forEach((file, index) => {
      aliases.set(file, `__func_precompiled_refs_v1_${index}`)
    })
  const accessors = analysis.references.map(reference => {
    const position = positions.get(reference.id)
    if (!position) throw new TypeError('Missing func precompiled reference.')
    const alias = aliases.get(position.file)
    if (!alias) throw new TypeError('Missing func precompiled reference module.')
    return `${alias}[${position.index}]`
  })
  return {
    accessors,
    aliases,
    analysis,
    plan,
    referencesByFile: grouped,
  }
}

const transformEntry = (code: string, compiled: CompiledApplication): string => {
  const { analysis } = compiled
  const imports = [
    `import { createAppFromPlan as ${CREATE_APP} } from ${JSON.stringify(PRECOMPILED_RUNTIME)};`,
    ...Array.from(compiled.aliases)
      .filter(([file]) => file !== analysis.entry)
      .map(([file, alias]) => `import { ${alias} } from ${JSON.stringify(file)};`),
  ].join('\n')
  const entryReferences = compiled.referencesByFile.get(analysis.entry) ?? []
  const entryAlias = compiled.aliases.get(analysis.entry)
  const declaration =
    entryReferences.length && entryAlias
      ? `const ${entryAlias} = [${entryReferences.join(',')}];\n`
      : ''
  const replacement = `${CREATE_APP}(${emitPlan(compiled.plan, compiled.accessors)}${analysis.optionArguments})`
  const transformed = [
    code.slice(0, analysis.statementStart),
    declaration,
    code.slice(analysis.statementStart, analysis.callStart),
    replacement,
    code.slice(analysis.callEnd),
  ].join('')
  return insertImports(transformed, imports)
}

const emitPlan = (value: unknown, references: readonly string[]): string => {
  if (isReferenceMarker(value)) {
    const reference = references[value.$funcRef]
    if (reference) return reference
    throw new TypeError('Invalid func precompiled reference marker.')
  }
  if (isGlobalMarker(value)) return value.$funcGlobal
  if (Array.isArray(value))
    return `[${value.map(item => emitPlan(item, references)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}:${emitPlan(item, references)}`)
      .join(',')}}`
  }
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

const isReferenceMarker = (value: unknown): value is { $funcRef: number } =>
  Boolean(
    value &&
    typeof value === 'object' &&
    '$funcRef' in value &&
    typeof value.$funcRef === 'number',
  )

const isGlobalMarker = (
  value: unknown,
): value is { $funcGlobal: 'Boolean' | 'Number' | 'String' | 'undefined' } =>
  Boolean(
    value &&
    typeof value === 'object' &&
    '$funcGlobal' in value &&
    (value.$funcGlobal === 'Boolean' ||
      value.$funcGlobal === 'Number' ||
      value.$funcGlobal === 'String' ||
      value.$funcGlobal === 'undefined'),
  )

const isPrecompilerModule = (value: unknown): value is PrecompilerModule =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'compileStaticApplication' in value &&
    typeof value.compileStaticApplication === 'function',
  )

const insertImports = (code: string, imports: string): string => {
  if (!code.startsWith('#!')) return `${imports}\n${code}`
  const newline = code.indexOf('\n')
  if (newline < 0) return `${code}\n${imports}\n`
  return `${code.slice(0, newline + 1)}${imports}\n${code.slice(newline + 1)}`
}

const normalizeId = (id: string): string => id.split('?', 1)[0].replace(/\\/g, '/')
