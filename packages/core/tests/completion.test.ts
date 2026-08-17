import * as func from '../src'
import {
  ArrayString,
  Command,
  CommandMajor,
  CommandMissing,
  Enum,
  Flag,
  Handler,
  Module,
  Value,
  createApp,
} from '../src'
import type { OnInit } from '../src'
import { spawnSync } from 'node:child_process'
import { Writable } from 'node:stream'
import {
  complete,
  completionEnvironmentVariable,
  completionSource,
  withCompletion,
} from '../src/subpath/completion'
import type { CompletionItemKind, CompletionResult } from '../src/subpath/completion'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

@CommandMajor()
class MajorCommand {
  @Flag({ description: 'print JSON output', negatable: true })
  json = false

  @Handler()
  run() {}

  @Handler({ description: 'diagnose the application', path: 'doctor' })
  doctor() {}
}

@Command({ aliases: ['dep', 'dp'], description: 'deploy releases', path: 'deploy' })
class DeployCommand {
  @Enum(['preview', 'production', 'staging'])
  @Value({ description: 'deployment target' })
  target?: string

  @ArrayString({ alias: 't', description: 'release tags' })
  tag: string[] = []

  @Flag({ negatable: true })
  verbose = false

  @Handler()
  run() {}
}

@Command({ description: 'manage projects', path: 'project' })
class ProjectCommand {
  @Handler({ description: 'add a project member', path: ['member', 'add'] })
  add() {}
}

@CommandMissing()
class MissingCommand {
  @Flag({ description: 'recover an unknown input' })
  recover = false

  @Handler()
  run() {}
}

@Module({
  commands: [MajorCommand, MissingCommand, DeployCommand, ProjectCommand],
})
class AppModule {}

test('should keep completion helpers out of the main entry', () => {
  expect('complete' in func).toBe(false)
  expect('completionSource' in func).toBe(false)
  expect('withCompletion' in func).toBe(false)
  expect('runWithCompletion' in func).toBe(false)
})

test('should complete root commands, aliases, nested paths, and major paths', () => {
  expect(
    values(complete(AppModule, { args: [], incomplete: '' }), 'command'),
  ).toEqual(['deploy', 'project', 'doctor'])
  expect(
    values(complete(AppModule, { args: [], incomplete: 'dp' }), 'command'),
  ).toEqual(['dp'])
  expect(
    values(
      complete(AppModule, {
        args: ['project', 'member'],
        incomplete: '',
      }),
      'command',
    ),
  ).toEqual(['add'])
})

test('should complete options and enum values from the active command plan', () => {
  const options = complete(AppModule, {
    args: ['deploy'],
    incomplete: '--t',
  })
  expect(values(options, 'option')).toEqual(['--target', '--tag'])

  const separated = complete(AppModule, {
    args: ['deploy', '--target'],
    incomplete: 'pr',
  })
  expect(values(separated, 'value')).toEqual(['preview', 'production'])
  expect(separated.fallback).toBe('none')

  const attached = complete(AppModule, {
    args: ['deploy'],
    incomplete: '--target=st',
  })
  expect(values(attached, 'value')).toEqual(['--target=staging'])
})

test('should hide supplied scalar options and retain repeatable options', () => {
  const result = complete(AppModule, {
    args: ['deploy', '--verbose', '--tag', 'first'],
    incomplete: '--',
  })
  expect(values(result, 'option')).not.toContain('--verbose')
  expect(values(result, 'option')).not.toContain('--no-verbose')
  expect(values(result, 'option')).toContain('--tag')
})

test('should use the missing-command option scope after unknown input', () => {
  const result = complete(AppModule, {
    args: ['unknown'],
    incomplete: '--r',
  })
  expect(values(result, 'option')).toEqual(['--recover'])
})

test('should compile completion metadata without constructing the application', () => {
  let constructed = 0
  let initialized = 0

  @CommandMajor()
  class Major {
    @Handler()
    run() {}
  }

  @Module({ commands: [Major] })
  class LazyApp implements OnInit {
    constructor() {
      constructed += 1
    }

    onInit() {
      initialized += 1
    }
  }

  complete(LazyApp, { args: [], incomplete: '' })
  expect(constructed).toBe(0)
  expect(initialized).toBe(0)
})

test('should generate adapters for supported shells', () => {
  expect(completionEnvironmentVariable('my-cli')).toBe('_MY_CLI_COMPLETE')
  expect(completionSource('ship', 'bash')).toContain('complete -o default')
  expect(completionSource('ship', 'fish')).toContain('complete -c')
  expect(completionSource('ship', 'powershell')).toContain(
    'Register-ArgumentCompleter -Native',
  )
  expect(completionSource('ship', 'zsh')).toContain('compdef')
})

test.each(['bash', 'zsh'] as const)(
  'should generate valid %s source when the shell is available',
  shell => {
    const checked = spawnSync(shell, ['-n'], {
      encoding: 'utf8',
      input: completionSource('ship', shell),
    })
    if (checked.error && 'code' in checked.error && checked.error.code === 'ENOENT')
      return
    expect(checked.stderr).toBe('')
    expect(checked.status).toBe(0)
  },
)

test.sequential(
  'should serve source and query modes before normal execution',
  async () => {
    const environment = completionEnvironmentVariable('ship')
    const previousExitCode = process.exitCode
    try {
      const sourceOutput = captureOutput()
      const sourceApp = createApp(AppModule, {
        features: [withCompletion({ bin: 'ship' })],
      })
      await sourceApp.bootstrap({
        env: { [environment]: 'bash_source' },
        stdout: sourceOutput.stream,
      })
      expect(process.exitCode).toBe(0)
      expect(sourceOutput.text()).toContain('complete -o default')
      const queryOutput = captureOutput()
      const queryApp = createApp(AppModule, {
        features: [withCompletion({ bin: 'ship' })],
      })
      await queryApp.bootstrap({
        argv: ['deploy', '--target', 'pr'],
        env: { [environment]: 'bash_complete' },
        stdout: queryOutput.stream,
      })
      expect(process.exitCode).toBe(0)
      expect(queryOutput.text()).toContain('preview\tdeployment target')
      expect(queryOutput.text()).toContain('production\tdeployment target')
    } finally {
      process.exitCode = previousExitCode
    }
  },
)

test('should reject duplicate completion features', () => {
  expect(() =>
    createApp(AppModule, {
      features: [withCompletion({ bin: 'ship' }), withCompletion({ bin: 'ship' })],
    }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_APPLICATION_FEATURE),
      message: systemErrorCode(SYSTEM.DUPLICATE_APPLICATION_FEATURE),
    }),
  )
})

test.sequential(
  'should continue normal bootstrap without a completion mode',
  async () => {
    let invoked = false
    const previousExitCode = process.exitCode

    @CommandMajor()
    class Major {
      @Handler()
      run() {
        invoked = true
      }
    }

    @Module({ commands: [Major] })
    class FeatureAppModule {}

    const app = createApp(FeatureAppModule, {
      features: [withCompletion({ bin: 'ship' })],
    })
    try {
      await app.bootstrap({ argv: [], env: {} })
      expect(invoked).toBe(true)
    } finally {
      process.exitCode = previousExitCode
    }
  },
)

test('should validate the completion bin at feature creation', () => {
  expect(() => withCompletion({ bin: '' })).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.INVALID_COMPLETION_BIN),
      message: systemErrorCode(SYSTEM.INVALID_COMPLETION_BIN),
    }),
  )
})

const values = (result: CompletionResult, kind: CompletionItemKind): string[] =>
  result.items
    .filter(candidate => candidate.kind === kind)
    .map(candidate => candidate.value)

const captureOutput = () => {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(
      chunk: string | Uint8Array,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}
