interface AcceptanceCaseBase {
  args: string[]
  id: string
}

export interface AcceptanceSuccessCase extends AcceptanceCaseBase {
  expectedJson?: Record<string, unknown>
  expectedText?: string
  success: true
}

export interface AcceptanceErrorCase extends AcceptanceCaseBase {
  errorIncludes: string
  success: false
}

export type AcceptanceCase = AcceptanceSuccessCase | AcceptanceErrorCase

export const acceptanceCases: AcceptanceCase[] = [
  {
    id: 'status-summary',
    success: true,
    args: ['status'],
    expectedText: 'status local (trace off)',
  },
  {
    id: 'status-json-with-global-options',
    success: true,
    args: ['status', '--profile', 'staging', '--trace', '--json'],
    expectedJson: { kind: 'status', profile: 'staging', trace: true },
  },
  {
    id: 'project-inspect-shared-options',
    success: true,
    args: [
      'project',
      'inspect',
      '--project',
      'payments',
      '--target',
      'production',
      '--label',
      'owner=platform',
      '--label',
      'tier=critical',
      '--profile',
      'staging',
      '--json',
    ],
    expectedJson: {
      kind: 'project-inspection',
      project: 'payments',
      target: 'production',
      labels: ['owner=platform', 'tier=critical'],
      dryRun: false,
      profile: 'staging',
    },
  },
  {
    id: 'project-sync-summary',
    success: true,
    args: [
      'project',
      'sync',
      '--project',
      'search',
      '--force',
      '--profile',
      'production',
    ],
    expectedText: 'sync search -> staging (force, production)',
  },
  {
    id: 'root-option-command',
    success: true,
    args: ['project', 'inspect', '--context', '--profile', 'staging', '--trace'],
    expectedText: 'context app project inspect (staging, trace on)',
  },
  {
    id: 'audit-list-module-options',
    success: true,
    args: ['audit', 'list', '--limit', '5', '--include-system'],
    expectedText: 'audit list 5 (summary, system on, local)',
  },
  {
    id: 'audit-export-option-override',
    success: true,
    args: [
      'audit',
      'export',
      '--format',
      'csv',
      '--limit',
      '50',
      '--profile',
      'staging',
      '--json',
    ],
    expectedJson: {
      kind: 'audit-export',
      format: 'csv',
      moduleFormat: 'summary',
      limit: 50,
      profile: 'staging',
    },
  },
  {
    id: 'scoped-option-command-override',
    success: true,
    args: [
      'audit',
      'list',
      '--context',
      '--format',
      'detailed',
      '--limit',
      '7',
      '--profile',
      'production',
    ],
    expectedText: 'context audit audit list (detailed/7, production)',
  },
  {
    id: 'missing-shared-project-option',
    success: false,
    args: ['project', 'inspect'],
    errorIncludes: 'project',
  },
  {
    id: 'invalid-shared-target-enum',
    success: false,
    args: ['project', 'inspect', '--project', 'payments', '--target', 'qa'],
    errorIncludes: 'target',
  },
  {
    id: 'sync-force-conflicts-with-dry-run',
    success: false,
    args: ['project', 'sync', '--project', 'payments', '--force', '--dry-run'],
    errorIncludes: 'force',
  },
  {
    id: 'project-module-error-boundary',
    success: false,
    args: ['project', 'sync', '--project', 'payments', '--conflict'],
    errorIncludes: 'conflict',
  },
  {
    id: 'invalid-global-profile-enum',
    success: false,
    args: ['status', '--profile', 'qa'],
    errorIncludes: 'profile',
  },
  {
    id: 'invalid-audit-list-format',
    success: false,
    args: ['audit', 'list', '--format', 'csv'],
    errorIncludes: 'format',
  },
  {
    id: 'invalid-audit-export-format',
    success: false,
    args: ['audit', 'export', '--format', 'detailed'],
    errorIncludes: 'format',
  },
  {
    id: 'invalid-audit-limit-type',
    success: false,
    args: ['audit', 'list', '--limit', 'many'],
    errorIncludes: 'limit',
  },
  {
    id: 'unknown-option',
    success: false,
    args: ['status', '--unknown-option'],
    errorIncludes: 'unknown',
  },
  {
    id: 'unknown-command',
    success: false,
    args: ['deploy'],
    errorIncludes: 'deploy',
  },
]
