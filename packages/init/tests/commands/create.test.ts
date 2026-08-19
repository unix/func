import { SCAFFOLD, formatScaffoldErrorCode } from '@func/contracts/scaffold-errors'
import { createTestingApp } from 'func/testing'
import { describe, expect, test, vi } from 'vitest'
import { AppModule } from '../../src/app.module'
import { resolveProjectName } from '../../src/commands/create/create.command'
import { CreateService } from '../../src/commands/create/create.service'

describe('resolveProjectName', () => {
  test('uses a positional project name', () => {
    expect(resolveProjectName(['my-app'])).toBe('my-app')
  })

  test('uses the interactive default when no name is provided', () => {
    expect(resolveProjectName([])).toBeUndefined()
  })

  test('rejects multiple positional arguments', () => {
    expect(() => resolveProjectName(['my-app', 'extra'])).toThrow(
      expect.objectContaining({
        code: formatScaffoldErrorCode(SCAFFOLD.MULTIPLE_PROJECT_NAMES),
      }),
    )
  })
})

describe('create-func application', () => {
  test('creates a named project through the create service', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke(['my-app'])
    expect(result).toMatchObject({ error: undefined, exitCode: 0 })
    expect(create).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith('my-app', expect.anything())
  })

  test('uses interactive project creation when no name is provided', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke()
    expect(result).toMatchObject({ error: undefined, exitCode: 0 })
    expect(create).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(undefined, expect.anything())
  })

  test('reports multiple project names through the application error handler', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke(['my-app', 'extra'])
    expect(result).toMatchObject({ error: undefined, exitCode: 1 })
    expect(result.stderr).toContain('Only one project name can be provided.')
    expect(result.stderr).toContain(
      'https://f.witt.im/SCAFFOLD_MULTIPLE_PROJECT_NAMES',
    )
    expect(create).not.toHaveBeenCalled()
  })

  test('prints standard func help without creating a project', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke(['--help'])
    expect(result).toMatchObject({ error: undefined, exitCode: 0 })
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('[inputs...] [options]')
    expect(result.stdout).toContain('--help')
    expect(result.stdout).toContain('--version')
    expect(create).not.toHaveBeenCalled()
  })

  test('prints the package version', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke(['-v'])
    expect(result).toMatchObject({ error: undefined, exitCode: 0 })
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/)
    expect(create).not.toHaveBeenCalled()
  })

  test('rejects unknown options', async () => {
    const { app, create } = createTestApp()
    const result = await app.invoke(['--unknown'])
    expect(result).toMatchObject({ error: undefined, exitCode: 1 })
    expect(result.stderr).toContain('Unknown option: --unknown.')
    expect(create).not.toHaveBeenCalled()
  })
})

const createTestApp = () => {
  const create = vi.fn<CreateService['create']>().mockResolvedValue(undefined)
  const app = createTestingApp(AppModule, {
    appName: 'create-func',
    overrides: [{ provide: CreateService, useValue: { create } }],
  })

  return { app, create }
}
