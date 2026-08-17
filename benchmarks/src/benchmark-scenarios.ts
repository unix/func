export interface BenchmarkScenario {
  args: string[]
  expectSuccess: boolean
  id: string
}

export const benchmarkScenarios: BenchmarkScenario[] = [
  {
    id: 'simple-routing',
    expectSuccess: true,
    args: ['status', '--profile', 'staging', '--json'],
  },
  {
    id: 'module-scoped-options',
    expectSuccess: true,
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
  },
  {
    id: 'option-command-override',
    expectSuccess: true,
    args: ['audit', 'list', '--context', '--format', 'detailed', '--limit', '7'],
  },
  {
    id: 'scoped-error-boundary',
    expectSuccess: false,
    args: ['project', 'sync', '--project', 'payments', '--conflict'],
  },
]
