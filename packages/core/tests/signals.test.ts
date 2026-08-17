import * as func from '../src'
import { CommandMajor, Context, Handler, Module, createApp } from '../src'
import { withProcessSignals } from '../src/subpath/signals'
import { createProcessSignalsFeature } from '../src/subpath/signals/feature'
import { SYSTEM, expect, systemErrorCode, test } from './_test'

type TestSignal = 'SIGINT' | 'SIGTERM'

class SignalTarget {
  readonly killed: Array<{ pid: number; signal: TestSignal }> = []
  readonly pid = 42

  private readonly listeners: Record<TestSignal, Set<() => void>> = {
    SIGINT: new Set(),
    SIGTERM: new Set(),
  }

  emit(signal: TestSignal): void {
    for (const listener of [...this.listeners[signal]]) listener()
  }

  kill(pid: number, signal: TestSignal): void {
    this.killed.push({ pid, signal })
  }

  listenerCount(signal: TestSignal): number {
    return this.listeners[signal].size
  }

  off(signal: TestSignal, listener: () => void): void {
    this.listeners[signal].delete(listener)
  }

  on(signal: TestSignal, listener: () => void): void {
    this.listeners[signal].add(listener)
  }
}

@CommandMajor()
class EmptyCommand {
  @Handler()
  run() {}
}

@Module({ commands: [EmptyCommand] })
class EmptyAppModule {}

test('should keep process signal handling out of the main entry', () => {
  expect('withProcessSignals' in func).toBe(false)
  expect(withProcessSignals).toBeTypeOf('function')
})

test('should reject duplicate process signal features', () => {
  expect(() =>
    createApp(EmptyAppModule, {
      features: [withProcessSignals(), withProcessSignals()],
    }),
  ).toThrow(
    expect.objectContaining({
      code: systemErrorCode(SYSTEM.DUPLICATE_APPLICATION_FEATURE),
      message: systemErrorCode(SYSTEM.DUPLICATE_APPLICATION_FEATURE),
    }),
  )
})

test.sequential.each([
  { exitCode: 130, signal: 'SIGINT' },
  { exitCode: 143, signal: 'SIGTERM' },
] as const)(
  'should abort the invocation and exit with $exitCode after $signal',
  async ({ exitCode, signal }) => {
    const started = Promise.withResolvers<AbortSignal>()
    const target = new SignalTarget()
    const previousExitCode = process.exitCode

    @CommandMajor()
    class WaitingCommand {
      constructor(private readonly context: Context) {}

      @Handler()
      async run() {
        started.resolve(this.context.signal)
        await new Promise<void>(resolve => {
          this.context.signal.addEventListener('abort', () => resolve(), {
            once: true,
          })
        })
      }
    }

    @Module({ commands: [WaitingCommand] })
    class WaitingAppModule {}

    const app = createApp(WaitingAppModule, {
      features: [createProcessSignalsFeature(target)],
    })

    try {
      const bootstrapped = app.bootstrap({ argv: [] })
      const invocationSignal = await started.promise
      target.emit(signal)
      await bootstrapped
      expect(invocationSignal.aborted).toBe(true)
      expect(invocationSignal.reason).toBe(signal)
      expect(process.exitCode).toBe(exitCode)
      expect(target.listenerCount('SIGINT')).toBe(0)
      expect(target.listenerCount('SIGTERM')).toBe(0)
    } finally {
      process.exitCode = previousExitCode
    }
  },
)

test.sequential(
  'should force native termination after a second signal',
  async () => {
    const released = Promise.withResolvers<void>()
    const started = Promise.withResolvers<AbortSignal>()
    const target = new SignalTarget()
    const previousExitCode = process.exitCode

    @CommandMajor()
    class WaitingCommand {
      constructor(private readonly context: Context) {}

      @Handler()
      async run() {
        started.resolve(this.context.signal)
        await released.promise
      }
    }

    @Module({ commands: [WaitingCommand] })
    class WaitingAppModule {}

    const app = createApp(WaitingAppModule, {
      features: [createProcessSignalsFeature(target)],
    })

    try {
      const bootstrapped = app.bootstrap({ argv: [] })
      const invocationSignal = await started.promise
      target.emit('SIGINT')
      target.emit('SIGTERM')
      expect(invocationSignal.aborted).toBe(true)
      expect(invocationSignal.reason).toBe('SIGINT')
      expect(target.killed).toEqual([{ pid: 42, signal: 'SIGTERM' }])
      expect(target.listenerCount('SIGINT')).toBe(0)
      expect(target.listenerCount('SIGTERM')).toBe(0)
      released.resolve()
      await bootstrapped
      expect(process.exitCode).toBe(130)
    } finally {
      released.resolve()
      process.exitCode = previousExitCode
    }
  },
)

test.sequential('should clean up listeners after normal completion', async () => {
  const target = new SignalTarget()
  const previousExitCode = process.exitCode
  const app = createApp(EmptyAppModule, {
    features: [createProcessSignalsFeature(target)],
  })

  try {
    await app.bootstrap({ argv: [] })
    expect(process.exitCode).toBe(0)
    expect(target.listenerCount('SIGINT')).toBe(0)
    expect(target.listenerCount('SIGTERM')).toBe(0)
  } finally {
    process.exitCode = previousExitCode
  }
})
