# CLI framework benchmarks

This package compares the workspace version of `func` with exact versions of
`commander`, `yargs`, `@oclif/core`, and `cac`.

The comparison uses one black-box CLI contract, not one shared implementation.
Every adapter independently owns its command declarations, parsing, validation,
error handling, business rules, and output assembly. The only shared artifacts are
the argv fixtures and their expected exit status, error fragments, text, or JSON.

## Workload

The workload is centered on CLI framework responsibilities rather than raw
JavaScript computation:

- Three command groups and four leaf actions exercise multi-entry routing, aliases,
  required and variadic positional arguments, and unknown input handling.
- The release path accepts up to 13 options spanning strings, integers, booleans,
  aliases, defaults, repeated values, and JSON output.
- Eight enum domains cover environments, regions, rollout strategies, profiles,
  file formats, schemas, platforms, and verification modes.
- Numeric parsing enforces four independent ranges. Repeated `key=value` options
  enforce syntax, limits, unique keys, and deterministic ordering.
- Cross-option rules cover dependencies, mutual exclusion, production safeguards,
  canary rollout requirements, file extensions, and artifact references.

`func` expresses its supported behavior through `@Required`, `@Enum`,
`@ValueValidate`, `@ArrayValue`, `@DependsOn`, `@Exclusive`, `@Catch`, and routing
decorators. Each competing adapter uses its own native API where available and
implements the remaining policy locally. The generated report records those
mechanisms explicitly.

## Run

From the repository root:

```sh
pnpm install
pnpm benchmarks
```

The command builds all production bundles, runs 27 acceptance cases against all
five implementations (135 fresh subprocess invocations), measures bundle sizes and
fresh-process wall time, and writes [`report.json`](./report.json).

Runtime sampling defaults to five warmups and 20 measured invocations per framework
and scenario. The counts can be overridden when investigating stability:

```sh
BENCHMARK_WARMUPS=10 BENCHMARK_ITERATIONS=50 pnpm benchmarks
```

## Methodology

- Implementation isolation: no parsing, validation, business, error, or output code
  is imported across adapters. Tests are the shared behavioral boundary.
- Acceptance: five success cases compare exact text or parsed JSON. Twenty-two error
  cases compare non-zero status and a semantic error fragment.
- Runtime: four scenarios measure end-to-end wall time for a fresh Node.js process:
  simple routing, a high-volume valid parse, enum rejection, and cross-option
  rejection. Framework order rotates for every sample.
- Bundle: all adapters use the same minified, tree-shaken esbuild ESM configuration
  targeting Node 24. Raw, gzip, and Brotli byte counts include adapter business code.
- Source: adapter UTF-8 bytes and non-blank lines are reported as implementation
  footprint context. This excludes fixtures, tests, and scripts and is not treated
  as a code-quality ranking.
- Authoring: DX and maintainability use five weighted criteria each. Every criterion
  is graded on the same 0–4 scale, and `report.json` records its weight, grade, and
  evidence. These are workload-specific engineering proxies, not framework-wide
  quality scores.
- oclif uses explicit command discovery and esbuild code splitting. Its size is the
  sum of the bin, command entry, and shared chunks. Production auto-transpilation is
  disabled, so the optional development-only TypeScript loader is externalized.
- `func` is compiled first so decorator metadata is emitted before the common bundle
  step.

Machine load affects timing results. Treat the committed report as a reproducible
snapshot for its recorded Node version and hardware, not as a universal constant.

## Current snapshot

The report generated on the recorded Apple M1 Max / Node 24.15 environment produced:

| Framework   | Raw bundle |       Gzip | Adapter non-blank lines | Mean fresh process | Versus func |
| ----------- | ---------: | ---------: | ----------------------: | -----------------: | ----------: |
| func        |  45.02 KiB |  13.38 KiB |                     366 |           40.13 ms |       1.00× |
| commander   |  44.91 KiB |  13.31 KiB |                     367 |           42.00 ms |       1.05× |
| yargs       | 115.12 KiB |  35.88 KiB |                     330 |           71.67 ms |       1.79× |
| @oclif/core | 331.31 KiB | 103.22 KiB |                     279 |           70.84 ms |       1.77× |
| cac         |  17.05 KiB |   6.32 KiB |                     335 |           38.80 ms |       0.97× |

The authoring evaluation for the same adapters is:

| Framework   | DX proxy | Maintainability proxy |
| ----------- | -------: | --------------------: |
| func        |       86 |                    83 |
| commander   |       58 |                    50 |
| yargs       |       73 |                    60 |
| @oclif/core |       78 |                    78 |
| cac         |       33 |                    28 |

In this snapshot, `cac` has the smallest and fastest artifact but requires local
implementations for most validation relationships. `func` is 107 raw bytes larger
than `commander` and starts about 1.9 ms faster while exposing more of the tested
policy as declarative framework capabilities. `yargs` and `@oclif/core` carry
noticeably more startup cost, while oclif's command-class API produces the shortest
adapter here. These are workload-specific trade-offs, not a single overall winner.

See `report.json` for the capability contract and mechanism matrix, per-scenario
min/median/mean/p95/max/deviation, source and compression sizes, relative deltas,
environment metadata, and rankings.
