import { describe, expect, test } from 'vitest'
import {
  buildTargets,
  buildTargetWarnings,
  defaultBuildTarget,
  resolveBuildTarget,
} from '../src/utils/build-target'

describe('build target', () => {
  test('defaults to Node.js 24', () => {
    expect(resolveBuildTarget()).toBe(defaultBuildTarget)
    expect(buildTargets[defaultBuildTarget].rolldown).toBe('node24.15')
  })

  test('supports Node.js 20, 22, and 24 targets', () => {
    expect(['n20', 'n22', 'n24'].map(resolveBuildTarget)).toEqual([
      'n20',
      'n22',
      'n24',
    ])
  })

  test('warns for every Node.js 20 build', () => {
    expect(buildTargetWarnings('n20', '>=20.19.0')).toEqual([
      'Node.js 20 has reached end-of-life and no longer receives security updates.',
    ])
  })

  test('warns without changing missing or mismatched engines', () => {
    expect(buildTargetWarnings('n22', undefined)).toEqual([
      'package.json#engines.node does not match target n22; expected a minimum of 22.12.0, received missing.',
    ])
    expect(buildTargetWarnings('n22', '>=24.15.0')).toEqual([
      'package.json#engines.node does not match target n22; expected a minimum of 22.12.0, received ">=24.15.0".',
    ])
  })

  test('accepts an engines range with the selected minimum', () => {
    expect(buildTargetWarnings('n22', '^22.12.0 || >=24.0.0')).toEqual([])
  })
})
