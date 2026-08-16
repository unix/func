import type {
  ApplicationFeature,
  BootstrapFeatureContext,
  BootstrapFeatureResult,
} from '../../application/features'
import { defineApplicationFeature } from '../../application/features'

type HandledProcessSignal = 'SIGINT' | 'SIGTERM'

export interface ProcessSignalTarget {
  readonly pid: number
  kill(pid: number, signal: HandledProcessSignal): void
  off(signal: HandledProcessSignal, listener: () => void): void
  on(signal: HandledProcessSignal, listener: () => void): void
}

const handledProcessSignals = ['SIGINT', 'SIGTERM'] as const
const signalExitCodes: Readonly<Record<HandledProcessSignal, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
}
const processSignalTarget: ProcessSignalTarget = {
  pid: process.pid,
  kill: (pid, signal) => {
    process.kill(pid, signal)
  },
  off: (signal, listener) => {
    process.off(signal, listener)
  },
  on: (signal, listener) => {
    process.on(signal, listener)
  },
}

const signalResult = (
  signal: HandledProcessSignal | undefined,
): BootstrapFeatureResult | undefined => {
  if (!signal) return undefined
  return { exitCode: signalExitCodes[signal] }
}

const withSignal = (
  context: BootstrapFeatureContext,
  signal: AbortSignal,
): BootstrapFeatureContext => Object.freeze({ ...context, signal })

export const createProcessSignalsFeature = (
  target: ProcessSignalTarget,
): ApplicationFeature =>
  defineApplicationFeature({
    key: 'process-signals',
    invoke: async (context, next) => {
      const controller = new AbortController()
      const listeners = new Map<HandledProcessSignal, () => void>()
      let receivedSignal: HandledProcessSignal | undefined

      const removeListeners = (): void => {
        for (const [signal, listener] of listeners) {
          target.off(signal, listener)
        }
      }

      for (const signal of handledProcessSignals) {
        const listener = (): void => {
          if (!receivedSignal) {
            receivedSignal = signal
            controller.abort(signal)
            return
          }

          removeListeners()
          target.kill(target.pid, signal)
        }

        listeners.set(signal, listener)
        target.on(signal, listener)
      }

      try {
        const invocationSignal = AbortSignal.any([context.signal, controller.signal])

        try {
          const result = await next(withSignal(context, invocationSignal))
          return signalResult(receivedSignal) ?? result
        } catch (error) {
          const result = signalResult(receivedSignal)
          if (result) return result
          throw error
        }
      } finally {
        removeListeners()
      }
    },
  })

export const withProcessSignals = (): ApplicationFeature =>
  createProcessSignalsFeature(processSignalTarget)
