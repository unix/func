import { frameworks, type Framework } from './frameworks.js'

export type AuthoringLevel = 0 | 1 | 2 | 3 | 4

interface AuthoringCriterion {
  id: string
  label: string
  measurement: string
  weight: number
}

interface AuthoringGrade {
  evidence: string
  level: AuthoringLevel
}

export const authoringScale = [
  {
    level: 0,
    label: 'absent',
    meaning: 'The tested workflow has no practical support for this criterion.',
  },
  {
    level: 1,
    label: 'local',
    meaning:
      'The adapter implements the concern locally with little framework help.',
  },
  {
    level: 2,
    label: 'mixed',
    meaning:
      'Framework primitives help, but recurring local glue is still required.',
  },
  {
    level: 3,
    label: 'supported',
    meaning: 'The framework carries the concern with small integration code.',
  },
  {
    level: 4,
    label: 'direct',
    meaning:
      'A typed framework mechanism carries the concern without duplicate rules.',
  },
] as const

export const authoringCriteria = {
  dx: [
    {
      id: 'type-continuity',
      label: 'Type continuity',
      measurement:
        'How precisely input declarations flow into handlers without assertions, coercion, or duplicated interfaces.',
      weight: 30,
    },
    {
      id: 'validation-authoring',
      label: 'Validation authoring',
      measurement:
        'How much of the tested input policy is expressed beside the input declaration instead of in local control flow.',
      weight: 25,
    },
    {
      id: 'command-composition',
      label: 'Command composition',
      measurement:
        'Whether commands can be isolated, nested, registered, and reused without rebuilding parser state by hand.',
      weight: 20,
    },
    {
      id: 'error-authoring',
      label: 'Error authoring',
      measurement:
        'How much normalized validation and error-boundary behavior the framework provides.',
      weight: 15,
    },
    {
      id: 'isolated-testing',
      label: 'Isolated testing',
      measurement:
        'How directly a command or parser can be exercised with supplied argv and without process-level side effects.',
      weight: 10,
    },
  ],
  maintainability: [
    {
      id: 'rule-locality',
      label: 'Rule locality',
      measurement:
        'Whether declarations and their validation relationships remain visible in the same local unit.',
      weight: 30,
    },
    {
      id: 'local-glue',
      label: 'Local glue burden',
      measurement:
        'How much parser-specific validation, normalization, and adapter control flow remains after business logic is excluded.',
      weight: 30,
    },
    {
      id: 'type-escapes',
      label: 'Type escape burden',
      measurement:
        'How often parsed values cross assertions, broad records, conversions, or manually duplicated type contracts.',
      weight: 20,
    },
    {
      id: 'command-isolation',
      label: 'Command isolation',
      measurement:
        'Whether commands have independent modules or classes with explicit registration boundaries.',
      weight: 10,
    },
    {
      id: 'error-boundary',
      label: 'Error boundary',
      measurement:
        'Whether failures converge on one framework-supported boundary instead of per-command catches.',
      weight: 10,
    },
  ],
} as const satisfies Record<string, readonly AuthoringCriterion[]>

type DxCriterionId = (typeof authoringCriteria.dx)[number]['id']
type MaintainabilityCriterionId =
  (typeof authoringCriteria.maintainability)[number]['id']

interface FrameworkAuthoringEvaluation {
  dx: Record<DxCriterionId, AuthoringGrade>
  maintainability: Record<MaintainabilityCriterionId, AuthoringGrade>
}

const authoringEvidence: Record<Framework, FrameworkAuthoringEvaluation> = {
  func: {
    dx: {
      'command-composition': {
        evidence:
          'Command classes and handler paths isolate command groups; the benchmark registers the command classes explicitly.',
        level: 3,
      },
      'error-authoring': {
        evidence:
          '@Catch and @CommandError provide framework boundaries; the adapter only normalizes benchmark output.',
        level: 4,
      },
      'isolated-testing': {
        evidence:
          'Command classes are isolated, while end-to-end parsing still runs through the func runtime.',
        level: 3,
      },
      'type-continuity': {
        evidence:
          'Decorator-backed class fields retain their declared TypeScript types through handlers without argument casts.',
        level: 4,
      },
      'validation-authoring': {
        evidence:
          'Required, enum, numeric, repeated, dependency, and exclusivity rules are adjacent decorators; release policy remains business code.',
        level: 3,
      },
    },
    maintainability: {
      'command-isolation': {
        evidence:
          'Each command group is represented by a command class with scoped handlers.',
        level: 3,
      },
      'error-boundary': {
        evidence: '@Catch and @CommandError converge parsing and command failures.',
        level: 4,
      },
      'local-glue': {
        evidence:
          'Parser adaptation is carried by decorators; local control flow is primarily workload-specific release policy and output assembly.',
        level: 3,
      },
      'rule-locality': {
        evidence:
          'Input shape and reusable validation rules sit on the affected fields; cross-field business policy stays in the handler.',
        level: 3,
      },
      'type-escapes': {
        evidence:
          'Handlers consume typed fields and FuncArgs without adapter-level assertions.',
        level: 4,
      },
    },
  },
  commander: {
    dx: {
      'command-composition': {
        evidence:
          'The command tree and reusable command factories support separation, with registration performed imperatively.',
        level: 3,
      },
      'error-authoring': {
        evidence:
          'exitOverride captures parser failures, while the adapter supplies local catches and normalized output.',
        level: 2,
      },
      'isolated-testing': {
        evidence:
          'Command instances can parse supplied argv, although process behavior must be disabled or overridden explicitly.',
        level: 3,
      },
      'type-continuity': {
        evidence:
          'The benchmark manually mirrors option declarations with ReleaseOptions, ConfigOptions, and ArtifactOptions interfaces.',
        level: 2,
      },
      'validation-authoring': {
        evidence:
          'Required values, choices, parsers, and conflicts are declarative; dependencies and business relationships remain local.',
        level: 2,
      },
    },
    maintainability: {
      'command-isolation': {
        evidence:
          'Subcommands have explicit tree boundaries, but the benchmark keeps registration and handlers in one adapter module.',
        level: 2,
      },
      'error-boundary': {
        evidence:
          'Parser errors and action errors require separate local normalization paths.',
        level: 2,
      },
      'local-glue': {
        evidence:
          'Argument parsers remove some conversion work, while relationship validation and safe execution wrappers remain local.',
        level: 2,
      },
      'rule-locality': {
        evidence:
          'Simple rules are adjacent to options; action-dependent and cross-field rules are implemented in action handlers.',
        level: 2,
      },
      'type-escapes': {
        evidence:
          'Manual option interfaces preserve handler types but duplicate the parser declarations.',
        level: 2,
      },
    },
  },
  yargs: {
    dx: {
      'command-composition': {
        evidence:
          'CommandModule objects isolate builders and handlers and can be registered independently or through a directory hierarchy.',
        level: 4,
      },
      'error-authoring': {
        evidence:
          'check and fail integrate with parser errors, while the benchmark still supplies a local catch and normalized output.',
        level: 2,
      },
      'isolated-testing': {
        evidence:
          'Command modules and parsers accept supplied argv without requiring process.argv.',
        level: 4,
      },
      'type-continuity': {
        evidence:
          'Builder return types now flow into CommandModule handlers without handler casts; an inference helper and external @types package remain necessary.',
        level: 3,
      },
      'validation-authoring': {
        evidence:
          'choices, demandOption, conflicts, and implies are declarative; numeric ranges and cross-field policy use three check callbacks.',
        level: 2,
      },
    },
    maintainability: {
      'command-isolation': {
        evidence:
          'Release, config, and artifact are independent CommandModule values with typed builders and handlers.',
        level: 4,
      },
      'error-boundary': {
        evidence:
          'fail integrates parser failures, followed by one local catch for benchmark output.',
        level: 2,
      },
      'local-glue': {
        evidence:
          'Native relationships remove some glue, but three check callbacks still own numeric and cross-field validation.',
        level: 2,
      },
      'rule-locality': {
        evidence:
          'Each check stays with its command builder, but several unrelated rules accumulate inside the callback.',
        level: 2,
      },
      'type-escapes': {
        evidence:
          'Typed builder inference removes handler assertions and boundary coercions; one helper connects builder and module generics.',
        level: 3,
      },
    },
  },
  oclif: {
    dx: {
      'command-composition': {
        evidence:
          'Independent Command classes and explicit discovery provide strong command boundaries with framework registration.',
        level: 4,
      },
      'error-authoring': {
        evidence:
          'The Config catch handler centralizes framework failures; the benchmark adds output normalization.',
        level: 3,
      },
      'isolated-testing': {
        evidence:
          'Command classes are independently addressable but require the oclif config and discovery harness.',
        level: 2,
      },
      'type-continuity': {
        evidence:
          'Args and Flags infer parsed values in command methods; the extracted release helper duplicates a ReleaseFlags interface.',
        level: 3,
      },
      'validation-authoring': {
        evidence:
          'Required values, options, integer ranges, repeated values, dependsOn, and exclusive are declarative; business policy remains local.',
        level: 3,
      },
    },
    maintainability: {
      'command-isolation': {
        evidence:
          'Every leaf action is an independent Command class discovered through one registry.',
        level: 4,
      },
      'error-boundary': {
        evidence: 'Config supplies a shared catch handler for command failures.',
        level: 3,
      },
      'local-glue': {
        evidence:
          'Flag parsing and relationships need little adapter glue; workload-specific release and artifact policy remains local.',
        level: 3,
      },
      'rule-locality': {
        evidence:
          'Most input rules sit in static Args and Flags declarations; business policy sits in command methods or the shared release helper.',
        level: 3,
      },
      'type-escapes': {
        evidence:
          'Parsed args and flags remain typed, with one manually mirrored interface at the shared release helper boundary.',
        level: 3,
      },
    },
  },
  cac: {
    dx: {
      'command-composition': {
        evidence:
          'Command schemas provide basic grouping, while nested behavior and normalization are assembled locally.',
        level: 2,
      },
      'error-authoring': {
        evidence:
          'The adapter owns validation errors, catching, formatting, and exit status.',
        level: 1,
      },
      'isolated-testing': {
        evidence:
          'The parser can receive argv, but command behavior remains coupled to local normalization and execution wrappers.',
        level: 2,
      },
      'type-continuity': {
        evidence:
          'Handlers receive broad option records and locally narrow or convert parsed values.',
        level: 1,
      },
      'validation-authoring': {
        evidence:
          'Command schemas describe option presence, while required, enum, numeric, repeated, and relationship validation is local.',
        level: 1,
      },
    },
    maintainability: {
      'command-isolation': {
        evidence:
          'Command schemas create named sections, but parsing, validation, and handlers share one adapter module.',
        level: 2,
      },
      'error-boundary': {
        evidence: 'A local catch normalizes every parser and handler failure.',
        level: 1,
      },
      'local-glue': {
        evidence:
          'Most validation and parsed-value normalization is implemented by adapter helpers and handler control flow.',
        level: 1,
      },
      'rule-locality': {
        evidence:
          'Option schemas and their required, enum, range, and relationship rules are split across declarations and handlers.',
        level: 1,
      },
      'type-escapes': {
        evidence:
          'Broad records and local conversions form the command-handler boundary.',
        level: 1,
      },
    },
  },
}

const score = <CriterionId extends string>(
  criteria: readonly (AuthoringCriterion & { id: CriterionId })[],
  grades: Record<CriterionId, AuthoringGrade>,
) =>
  Math.round(
    criteria.reduce(
      (total, criterion) =>
        total + criterion.weight * (grades[criterion.id].level / 4),
      0,
    ),
  )

export const authoringEvaluation = {
  criteria: authoringCriteria,
  frameworks: Object.fromEntries(
    frameworks.map(framework => {
      const evidence = authoringEvidence[framework]

      return [
        framework,
        {
          dx: {
            evidence: evidence.dx,
            score: score(authoringCriteria.dx, evidence.dx),
          },
          maintainability: {
            evidence: evidence.maintainability,
            score: score(
              authoringCriteria.maintainability,
              evidence.maintainability,
            ),
          },
        },
      ]
    }),
  ) as Record<
    Framework,
    {
      dx: { evidence: Record<DxCriterionId, AuthoringGrade>; score: number }
      maintainability: {
        evidence: Record<MaintainabilityCriterionId, AuthoringGrade>
        score: number
      }
    }
  >,
  scale: authoringScale,
}
