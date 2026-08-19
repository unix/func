import { minVersion, satisfies } from 'semver'

export const buildTargets = {
  n20: {
    node: '20.19.0',
    rolldown: 'node20.19',
  },
  n22: {
    node: '22.12.0',
    rolldown: 'node22.12',
  },
  n24: {
    node: '24.15.0',
    rolldown: 'node24.15',
  },
} as const

export type BuildTarget = keyof typeof buildTargets

export const defaultBuildTarget: BuildTarget = 'n24'

export const resolveBuildTarget = (value?: string): BuildTarget => {
  const target = value ?? defaultBuildTarget
  if (isBuildTarget(target)) return target

  throw new RangeError(
    `Unsupported build target "${target}". Expected one of: ${Object.keys(buildTargets).join(', ')}.`,
  )
}

export const buildTargetWarnings = (
  target: BuildTarget,
  nodeEngine: unknown,
): string[] => {
  const warnings: string[] = []
  const required = buildTargets[target].node

  if (target === 'n20') {
    warnings.push(
      'Node.js 20 has reached end-of-life and no longer receives security updates.',
    )
  }

  if (matchesNodeEngine(nodeEngine, required)) return warnings
  const received = nodeEngine === undefined ? 'missing' : JSON.stringify(nodeEngine)
  warnings.push(
    `package.json#engines.node does not match target ${target}; expected a minimum of ${required}, received ${received}.`,
  )
  return warnings
}

const isBuildTarget = (value: string): value is BuildTarget =>
  Object.prototype.hasOwnProperty.call(buildTargets, value)

const matchesNodeEngine = (value: unknown, required: string): boolean => {
  if (typeof value !== 'string') return false
  const minimum = minVersion(value)
  return minimum?.version === required && satisfies(required, value)
}
