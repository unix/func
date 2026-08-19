import { spawnSync } from 'node:child_process'
import { cpus, freemem, platform, release, totalmem } from 'node:os'
import { performance } from 'node:perf_hooks'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acceptanceCases } from '../.build/acceptance-cases.js'
import { authoringEvaluation } from '../.build/authoring-evaluation.js'
import { benchmarkScenarios } from '../.build/benchmark-scenarios.js'
import { frameworks } from '../.build/frameworks.js'

const benchmarkRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputFile = join(benchmarkRoot, 'report.json')
const iterations = positiveInteger(process.env.BENCHMARK_ITERATIONS, 20)
const warmups = positiveInteger(process.env.BENCHMARK_WARMUPS, 5)
const packageJson = JSON.parse(
  await readFile(join(benchmarkRoot, 'package.json'), 'utf8'),
)
const packageNames = {
  func: 'func',
  'func-parser': 'func',
  commander: 'commander',
  yargs: 'yargs',
  oclif: '@oclif/core',
  cac: 'cac',
}

const capabilityContract = [
  {
    id: 'multi-entry-routing',
    requirement:
      'Status plus project inspect/sync and audit list/export leaves, with unknown-command handling.',
  },
  {
    id: 'application-scope',
    requirement:
      'Profile, JSON, and trace options shared by every command from application scope.',
  },
  {
    id: 'feature-scope',
    requirement:
      'Project and audit option sets each shared by multiple sibling commands without shared runtime benchmark code.',
  },
  {
    id: 'alternate-option-actions',
    requirement:
      'A root --context option replaces normal execution, with audit scope replacing its behavior.',
  },
  {
    id: 'option-parsing-and-validation',
    requirement:
      'Required, enum, aliased, defaulted, repeated, integer, boolean, and mutually exclusive options.',
  },
  {
    id: 'nested-option-override',
    requirement:
      'Audit export replaces the audit module format domain and default while retaining the module value.',
  },
  {
    id: 'scoped-errors',
    requirement:
      'Project conflicts use feature error policy while parser and other failures use application policy.',
  },
  {
    id: 'shared-output',
    requirement:
      'Deterministic text and JSON success output through one adapter-owned output boundary.',
  },
]

const capabilityMechanisms = {
  func: {
    routing: '@Command + @Handler',
    applicationScope: 'AppModule + AppOptions',
    featureScope: 'ProjectModule/AuditModule option providers',
    alternateActions: '@OptionCommand + overrideAll',
    required: '@Required',
    enums: '@Enum',
    numericValues: '@Value typed field conversion',
    repeatedValues: '@ArrayString',
    exclusivity: '@Exclusive',
    override: '@Override',
    errorBoundary: 'module onError chain',
    output: 'Output provider + @Stdout',
  },
  'func-parser': {
    routing: 'composed createParser instances + passthrough',
    applicationScope: 'shared parser option definition + explicit merge',
    featureScope: 'project/audit parser definitions',
    alternateActions: 'local handler interception helpers',
    required: 'local validation',
    enums: 'local validation',
    numericValues: 'Number parser + local integer validation',
    repeatedValues: 'multiple parser options',
    exclusivity: 'local validation',
    override: 'command-specific local domains and defaults',
    errorBoundary: 'ParserError + local catch',
    output: 'shared local output helper',
  },
  commander: {
    routing: 'Command subcommand tree',
    applicationScope: 'global options + optsWithGlobals',
    featureScope: 'reusable option factories + local merges',
    alternateActions: 'shared handler interception helper',
    required: 'context-aware local required helper',
    enums: 'Option.choices',
    numericValues: 'Option.argParser',
    repeatedValues: 'Option.argParser collector',
    exclusivity: 'Option.conflicts',
    override: 'distinct leaf option factory arguments',
    errorBoundary: 'exitOverride + local catch',
    output: 'shared local output helper',
  },
  yargs: {
    routing: 'command builders',
    applicationScope: 'global options',
    featureScope: 'project/audit builders',
    alternateActions: 'shared handler interception helpers',
    required: 'context-aware local required helper',
    enums: 'choices',
    numericValues: 'number parsing + check',
    repeatedValues: 'array options',
    exclusivity: 'conflicts',
    override: 'action-specific builder check and defaults',
    errorBoundary: 'fail + local catch',
    output: 'shared local output helper',
  },
  oclif: {
    routing: 'explicit Command classes',
    applicationScope: 'shared appFlags object + base command',
    featureScope: 'shared feature flag objects',
    alternateActions: 'base-command interception methods',
    required: 'context-aware base-command helper',
    enums: 'Flags options',
    numericValues: 'Flags.integer',
    repeatedValues: 'multiple flags',
    exclusivity: 'Flags exclusive',
    override: 'distinct export flag definition',
    errorBoundary: 'entry catch + project error classification',
    output: 'base-command output method',
  },
  cac: {
    routing: 'command schemas',
    applicationScope: 'global options',
    featureScope: 'flat command option declarations',
    alternateActions: 'local handler interception helpers',
    required: 'local validation',
    enums: 'local oneOf validation',
    numericValues: 'local integer validation',
    repeatedValues: 'option accumulation + local normalization',
    exclusivity: 'local validation',
    override: 'action-specific local defaults and domains',
    errorBoundary: 'local catch',
    output: 'shared local output helper',
  },
}

const frameworkMetadata = Object.fromEntries(
  frameworks.map(framework => {
    const packageName = packageNames[framework]
    const version = packageJson.dependencies[packageName]
    return [framework, { package: packageName, version }]
  }),
)

const bundle = {}
for (const framework of frameworks) {
  const directory = join(benchmarkRoot, 'dist', framework)
  const files = (await runtimeFiles(directory)).sort()
  const artifacts = files.map(file => `${file}.gz`)
  const contents = await Promise.all(artifacts.map(file => readFile(file)))
  bundle[framework] = {
    artifacts: artifacts.map(file => relative(benchmarkRoot, file)),
    fileCount: artifacts.length,
    gzipBytes: contents.reduce((total, content) => total + content.byteLength, 0),
    source: await sourceSize(framework),
  }
}

addBundleComparisons(bundle)

const samples = Object.fromEntries(
  benchmarkScenarios.map(scenario => [
    scenario.id,
    Object.fromEntries(frameworks.map(framework => [framework, []])),
  ]),
)

for (const scenario of benchmarkScenarios) {
  for (let warmup = 0; warmup < warmups; warmup += 1) {
    for (const framework of rotatedFrameworks(warmup))
      runInvocation(framework, scenario)
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const framework of rotatedFrameworks(iteration)) {
      samples[scenario.id][framework].push(runInvocation(framework, scenario))
    }
  }
}

const runtimeScenarios = Object.fromEntries(
  benchmarkScenarios.map(scenario => {
    const results = Object.fromEntries(
      frameworks.map(framework => [
        framework,
        statistics(samples[scenario.id][framework]),
      ]),
    )
    addRuntimeComparisons(results)

    return [
      scenario.id,
      {
        args: scenario.args,
        expectSuccess: scenario.expectSuccess,
        results,
      },
    ]
  }),
)

const runtimeOverall = Object.fromEntries(
  frameworks.map(framework => {
    const means = benchmarkScenarios.map(
      scenario => runtimeScenarios[scenario.id].results[framework].meanMs,
    )

    return [framework, { meanMs: round(mean(means)) }]
  }),
)
addRuntimeComparisons(runtimeOverall)

const report = {
  schemaVersion: 5,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    platformRelease: release(),
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCores: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytesAtStart: freemem(),
  },
  frameworks: frameworkMetadata,
  toolchain: {
    func: {
      package: 'funcgo',
      version: packageJson.devDependencies.funcgo,
    },
  },
  methodology: {
    implementation: {
      runtimeCodeShared: false,
      mode: 'Every adapter independently implements parsing, validation, error handling, business rules, and output assembly.',
      sharedArtifacts: [
        'black-box argv fixtures',
        'expected exit status and error fragments',
        'expected text and JSON output',
        'runtime scenario argv',
      ],
    },
    acceptance: {
      caseCount: acceptanceCases.length,
      successCaseCount: acceptanceCases.filter(testCase => testCase.success).length,
      errorCaseCount: acceptanceCases.filter(testCase => !testCase.success).length,
      invocationCount: acceptanceCases.length * frameworks.length,
      mode: 'Each final bundle is executed as a subprocess against the same black-box cases.',
    },
    authoring: {
      mode: 'Weighted, evidence-backed review of the committed adapters against a shared 0-4 rubric.',
      interpretation:
        'DX and maintainability are workload-specific authoring proxies. Every grade, weight, and evidence note is included in this report; they are not universal framework rankings.',
      scoreFormula:
        'For each dimension, sum criterion weight × level / 4, then round to an integer from 0 to 100.',
    },
    bundle: {
      mode: 'func uses the minified CommonJS output from funcgo/Rolldown; competitors use minified, tree-shaken esbuild ESM targeting Node 24.',
      metric:
        'Sum of the emitted level-9 gzip artifacts for all runtime JavaScript files. oclif uses explicit discovery with shared chunks.',
      exclusions:
        'Build metadata and package manifests are excluded. oclif auto-transpilation is disabled and its optional development-only typescript loader is externalized.',
    },
    source: {
      mode: 'UTF-8 bytes and non-blank lines in each independent adapter implementation.',
      exclusions:
        'Shared black-box fixtures, tests, build scripts, and report scripts.',
      interpretation:
        'A context metric for implementation footprint, not a code-quality ranking.',
    },
    runtime: {
      mode: 'End-to-end wall time of a fresh Node.js process with piped stdout and stderr.',
      order: 'Framework order rotates for every sample to reduce ordering bias.',
      iterations,
      warmups,
    },
  },
  capabilities: {
    contract: capabilityContract,
    mechanisms: capabilityMechanisms,
  },
  authoring: authoringEvaluation,
  bundle,
  runtime: {
    scenarios: runtimeScenarios,
    overall: runtimeOverall,
  },
  rankings: {
    bundleGzipBytes: ranked(bundle, value => value.gzipBytes),
    runtimeMeanMs: ranked(runtimeOverall, value => value.meanMs),
  },
}

await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`)

console.table(
  Object.fromEntries(
    frameworks.map(framework => [
      framework,
      {
        gzipKiB: round(bundle[framework].gzipBytes / 1024),
        sourceLines: bundle[framework].source.nonBlankLines,
        meanMs: runtimeOverall[framework].meanMs,
        versusFunc: runtimeOverall[framework].relativeToFunc.meanRatio,
      },
    ]),
  ),
)
console.log(`Report written to ${outputFile}`)

function runInvocation(framework, scenario) {
  const executable = join(
    benchmarkRoot,
    'dist',
    framework,
    framework === 'func' ? 'bin.js' : 'bin.mjs',
  )
  const start = performance.now()
  const result = spawnSync(process.execPath, [executable, ...scenario.args], {
    cwd: benchmarkRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    timeout: 10_000,
  })
  const elapsed = performance.now() - start
  if (result.error) throw result.error
  const succeeded = result.status === 0
  if (succeeded === scenario.expectSuccess) return elapsed

  throw new Error(
    `${framework}/${scenario.id} returned ${result.status}: ${result.stderr || result.stdout}`,
  )
}

function statistics(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const average = mean(sorted)
  const variance = mean(sorted.map(value => (value - average) ** 2))

  return {
    samples: sorted.length,
    minMs: round(sorted[0]),
    medianMs: round(percentile(sorted, 0.5)),
    meanMs: round(average),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1)),
    standardDeviationMs: round(Math.sqrt(variance)),
  }
}

function addRuntimeComparisons(results) {
  const baseline = results.func.meanMs
  for (const framework of frameworks) {
    const value = results[framework]
    value.relativeToFunc = {
      meanDeltaMs: round(value.meanMs - baseline),
      meanDeltaPercent: round(((value.meanMs - baseline) / baseline) * 100),
      meanRatio: round(value.meanMs / baseline),
    }
  }
}

function addBundleComparisons(results) {
  const baseline = results.func
  for (const framework of frameworks) {
    const value = results[framework]
    value.source.relativeToFunc = {
      byteDelta: value.source.bytes - baseline.source.bytes,
      byteRatio: round(value.source.bytes / baseline.source.bytes),
      nonBlankLineDelta: value.source.nonBlankLines - baseline.source.nonBlankLines,
      nonBlankLineRatio: round(
        value.source.nonBlankLines / baseline.source.nonBlankLines,
      ),
    }
    value.relativeToFunc = {
      gzipDeltaBytes: value.gzipBytes - baseline.gzipBytes,
      gzipDeltaPercent: round(
        ((value.gzipBytes - baseline.gzipBytes) / baseline.gzipBytes) * 100,
      ),
      gzipRatio: round(value.gzipBytes / baseline.gzipBytes),
    }
  }
}

async function runtimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await runtimeFiles(path)))
      continue
    }
    if (['.cjs', '.js', '.mjs'].includes(extname(entry.name))) files.push(path)
  }

  return files
}

async function sourceSize(framework) {
  const names =
    framework === 'oclif' ? ['oclif.ts', 'oclif-commands.ts'] : [`${framework}.ts`]
  const files = names.map(name => join(benchmarkRoot, 'src', 'adapters', name))
  const contents = await Promise.all(files.map(file => readFile(file, 'utf8')))

  return {
    files: files.map(file => relative(benchmarkRoot, file)),
    bytes: contents.reduce(
      (total, content) => total + Buffer.byteLength(content),
      0,
    ),
    nonBlankLines: contents.reduce(
      (total, content) =>
        total + content.split('\n').filter(line => line.trim()).length,
      0,
    ),
  }
}

function percentile(sorted, value) {
  const index = Math.max(0, Math.ceil(sorted.length * value) - 1)
  return sorted[index]
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function rotatedFrameworks(offset) {
  return frameworks.map(
    (_, index) => frameworks[(index + offset) % frameworks.length],
  )
}

function ranked(values, select) {
  return Object.entries(values)
    .sort(([, left], [, right]) => select(left) - select(right))
    .map(([framework], index) => ({ framework, rank: index + 1 }))
}

function positiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  throw new Error(`Expected a positive integer, received "${value}".`)
}

function round(value) {
  return Math.round(value * 1000) / 1000
}
