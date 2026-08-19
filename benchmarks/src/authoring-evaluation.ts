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
        'How precisely shared option declarations flow into handlers without assertions, coercion, or duplicated interfaces.',
      weight: 20,
    },
    {
      id: 'scope-composition',
      label: 'Scope composition',
      measurement:
        'How directly application and feature scopes share options and services across multiple commands.',
      weight: 25,
    },
    {
      id: 'validation-authoring',
      label: 'Validation authoring',
      measurement:
        'How much required, enum, repeated, numeric, and exclusive option behavior stays beside declarations.',
      weight: 15,
    },
    {
      id: 'alternate-actions',
      label: 'Alternate option actions',
      measurement:
        'How directly one option can replace normal command execution and be overridden in a nested scope.',
      weight: 20,
    },
    {
      id: 'boundary-authoring',
      label: 'Boundary authoring',
      measurement:
        'How directly shared output plus application and feature error boundaries are expressed.',
      weight: 20,
    },
  ],
  maintainability: [
    {
      id: 'shared-option-locality',
      label: 'Shared option locality',
      measurement:
        'Whether options shared by sibling commands have one explicit owner and one consumption path.',
      weight: 25,
    },
    {
      id: 'override-locality',
      label: 'Override locality',
      measurement:
        'Whether nested option and alternate-action overrides are declared where scope changes.',
      weight: 20,
    },
    {
      id: 'local-glue',
      label: 'Local glue burden',
      measurement:
        'How much parser-specific merging, normalization, dispatch, and interception remains.',
      weight: 25,
    },
    {
      id: 'command-isolation',
      label: 'Command isolation',
      measurement:
        'Whether command behavior has explicit registration and ownership boundaries.',
      weight: 15,
    },
    {
      id: 'boundary-locality',
      label: 'Boundary locality',
      measurement:
        'Whether output and error policy are centralized at the intended application or feature scope.',
      weight: 15,
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
      'alternate-actions': {
        evidence:
          '@OptionCommand replaces normal execution at application scope, and the audit module overrides it with overrideAll.',
        level: 4,
      },
      'boundary-authoring': {
        evidence:
          'An injected @Stdout output service is shared through a module; module onError hooks define application and project failure policy.',
        level: 3,
      },
      'scope-composition': {
        evidence:
          'AppOptions, ProjectOptions, AuditOptions, and Output are injected from their owning modules into sibling commands.',
        level: 4,
      },
      'type-continuity': {
        evidence:
          'Decorator-backed class fields flow into handlers and services as typed instances without option-record assertions.',
        level: 4,
      },
      'validation-authoring': {
        evidence:
          '@Required, @Enum, @ArrayString, @Value, @Flag, and @Exclusive keep the tested input policy on fields.',
        level: 4,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'Output is owned by OutputModule, project conflicts by ProjectModule, and remaining failures by AppModule.',
        level: 4,
      },
      'command-isolation': {
        evidence:
          'Project handlers share one command class while audit leaves remain explicit commands registered by AuditModule.',
        level: 3,
      },
      'local-glue': {
        evidence:
          'The adapter has no option-record merging or manual input normalization; output assembly and the project conflict remain local.',
        level: 3,
      },
      'override-locality': {
        evidence:
          '@Override is attached to audit export format and the audit OptionCommand override is registered only in AuditModule.',
        level: 4,
      },
      'shared-option-locality': {
        evidence:
          'Each shared option class is registered once at its owning module and injected into every consumer.',
        level: 4,
      },
    },
  },
  'func-parser': {
    dx: {
      'alternate-actions': {
        evidence:
          'Root and audit context behavior is implemented through explicit early interception in local dispatch code.',
        level: 1,
      },
      'boundary-authoring': {
        evidence:
          'ParserError supplies structured parse failures, but output, application and feature classification, formatting, and exit status are all implemented locally.',
        level: 1,
      },
      'scope-composition': {
        evidence:
          'Root, project, and audit parsers reuse one app option definition, with values merged explicitly across passthrough boundaries.',
        level: 2,
      },
      'type-continuity': {
        evidence:
          'createParser infers command and option result unions, while AppInvocation and AppValues duplicate the shared application shape at the merge boundary.',
        level: 3,
      },
      'validation-authoring': {
        evidence:
          'Primitive conversion and repeated values are declarative; defaults, required, enums, integers, and exclusivity remain local.',
        level: 2,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'One local catch owns failures, but project classification is not attached to a parser scope.',
        level: 2,
      },
      'command-isolation': {
        evidence:
          'Root, project, and audit parsing have separate definitions; execution dispatch remains in one adapter flow.',
        level: 2,
      },
      'local-glue': {
        evidence:
          'Nested routing requires passthrough parsing, application-option merging, dispatch, validation, and interception code.',
        level: 1,
      },
      'override-locality': {
        evidence:
          'Audit format and context overrides are conditional values in local dispatch because parser definitions cannot override merged options.',
        level: 1,
      },
      'shared-option-locality': {
        evidence:
          'Application options have one reusable definition, and project/audit options each have one feature parser owner.',
        level: 3,
      },
    },
  },
  commander: {
    dx: {
      'alternate-actions': {
        evidence:
          'A shared helper checks --context from each action; audit callers explicitly choose the scoped context behavior.',
        level: 2,
      },
      'boundary-authoring': {
        evidence:
          'One output helper and one final catch normalize behavior, while project classification is a local instanceof branch.',
        level: 2,
      },
      'scope-composition': {
        evidence:
          'Reusable option factories model feature scope, but each action merges local and global option records.',
        level: 2,
      },
      'type-continuity': {
        evidence:
          'Manual interfaces and assertions mirror option declarations at optsWithGlobals boundaries.',
        level: 2,
      },
      'validation-authoring': {
        evidence:
          'choices, parsers, and conflicts are declarative; context-compatible required handling stays local.',
        level: 3,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'Output and final error normalization are centralized, but there is no feature-owned error boundary.',
        level: 2,
      },
      'command-isolation': {
        evidence:
          'The command tree has explicit leaves, with registration and handlers retained in one adapter module.',
        level: 2,
      },
      'local-glue': {
        evidence:
          'Each action merges global and local options and invokes local interception or required-option helpers.',
        level: 2,
      },
      'override-locality': {
        evidence:
          'Audit export and audit context overrides are recreated through call-site arguments and replacement values.',
        level: 2,
      },
      'shared-option-locality': {
        evidence:
          'Project and audit option factories remove declaration duplication but do not create an owned runtime scope.',
        level: 3,
      },
    },
  },
  yargs: {
    dx: {
      'alternate-actions': {
        evidence:
          'Handlers call context helpers before normal execution, with audit override behavior selected in the audit handler.',
        level: 2,
      },
      'boundary-authoring': {
        evidence:
          'Shared output and fail helpers centralize policy; scoped project classification remains a local instanceof branch.',
        level: 2,
      },
      'scope-composition': {
        evidence:
          'Command builders share feature options, while application options are global and feature state remains flat argv data.',
        level: 3,
      },
      'type-continuity': {
        evidence:
          'Typed argument interfaces reach handlers, with declarations mirrored manually across builder and interface shapes.',
        level: 3,
      },
      'validation-authoring': {
        evidence:
          'choices, number parsing, arrays, and conflicts are declarative; one audit check selects the action-specific enum.',
        level: 3,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'One final catch owns output, but feature error classification is not attached to a command scope.',
        level: 2,
      },
      'command-isolation': {
        evidence:
          'Builders isolate project and audit declarations; action dispatch remains inside their shared handlers.',
        level: 3,
      },
      'local-glue': {
        evidence:
          'Builder inference handles parsing while action dispatch, required handling, and interception remain local.',
        level: 2,
      },
      'override-locality': {
        evidence:
          'Audit format and context differences are conditional values inside one audit builder and handler.',
        level: 2,
      },
      'shared-option-locality': {
        evidence:
          'Project and audit builder functions provide one declaration path for their sibling actions.',
        level: 3,
      },
    },
  },
  oclif: {
    dx: {
      'alternate-actions': {
        evidence:
          'A base command supplies interception helpers, but every leaf must call one and export must replace context format manually.',
        level: 2,
      },
      'boundary-authoring': {
        evidence:
          'Base-command output and one entry catch centralize behavior; project classification is local to the catch.',
        level: 3,
      },
      'scope-composition': {
        evidence:
          'Shared flag objects and a base command compose application and feature behavior across independent commands.',
        level: 3,
      },
      'type-continuity': {
        evidence:
          'Flags infer leaf command values, and shared helpers consume explicit AppFlags and AuditFlags contracts.',
        level: 4,
      },
      'validation-authoring': {
        evidence:
          'options, integer parsing, repeated flags, and exclusivity remain declarative in shared flag definitions.',
        level: 4,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'Output lives on the base command and all failures converge at the entry point, without feature-owned registration.',
        level: 3,
      },
      'command-isolation': {
        evidence:
          'Every leaf is an independent Command class registered in the explicit discovery map.',
        level: 4,
      },
      'local-glue': {
        evidence:
          'Parsing needs little normalization, while context interception is repeated once in every run method.',
        level: 3,
      },
      'override-locality': {
        evidence:
          'Export owns a distinct flag definition, but scoped context replacement is assembled in the run method.',
        level: 3,
      },
      'shared-option-locality': {
        evidence:
          'Application, project, and audit flag objects are reusable, explicit declaration owners.',
        level: 3,
      },
    },
  },
  cac: {
    dx: {
      'alternate-actions': {
        evidence:
          'Handlers explicitly invoke local interception helpers and select the audit replacement values.',
        level: 1,
      },
      'boundary-authoring': {
        evidence:
          'Local helpers own output, catching, classification, and exit status without scoped framework boundaries.',
        level: 1,
      },
      'scope-composition': {
        evidence:
          'Global options are shared, while project and audit declarations and normalization remain on flat command schemas.',
        level: 1,
      },
      'type-continuity': {
        evidence:
          'Handlers receive broad option records and narrow or convert their values locally.',
        level: 1,
      },
      'validation-authoring': {
        evidence:
          'Defaults are declared, while enum, required, integer, repeated, and exclusivity behavior is implemented locally.',
        level: 1,
      },
    },
    maintainability: {
      'boundary-locality': {
        evidence:
          'One local catch centralizes failures, but project scope is only an instanceof branch.',
        level: 1,
      },
      'command-isolation': {
        evidence:
          'Command schemas create named sections, while action dispatch and all normalization remain in their handlers.',
        level: 2,
      },
      'local-glue': {
        evidence:
          'Broad option records require local enum, integer, list, required, conflict, and interception helpers.',
        level: 1,
      },
      'override-locality': {
        evidence:
          'Both audit overrides are recreated as conditional handler values.',
        level: 1,
      },
      'shared-option-locality': {
        evidence:
          'Global options have one owner, but feature option behavior is coupled to flat command handlers.',
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
