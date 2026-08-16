import type {
  TerminalDemoRunMessage,
  TerminalDemoStream,
  TerminalDemoWorkerMessage,
} from './protocol'
import { runTerminalDemo } from './registry'

interface TerminalDemoWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<TerminalDemoRunMessage>) => void,
  ): void
  postMessage(message: TerminalDemoWorkerMessage): void
}

const isTerminalDemoWorkerScope = (
  value: unknown,
): value is TerminalDemoWorkerScope => {
  if (typeof value !== 'object' || value === null) return false

  return (
    'addEventListener' in value &&
    typeof value.addEventListener === 'function' &&
    'postMessage' in value &&
    typeof value.postMessage === 'function'
  )
}

if (!isTerminalDemoWorkerScope(globalThis)) {
  throw new Error('Terminal demo must run in a worker')
}

const workerScope = globalThis

const formatValue = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message

  try {
    const formatted: unknown = JSON.stringify(value, null, 2)
    if (typeof formatted === 'string') return formatted
    return String(value)
  } catch {
    return String(value)
  }
}

const writeOutput = (stream: TerminalDemoStream, values: unknown[]) => {
  workerScope.postMessage({
    stream,
    text: values.map(formatValue).join(' '),
    type: 'output',
  })
}

workerScope.addEventListener(
  'message',
  async (event: MessageEvent<TerminalDemoRunMessage>) => {
    const originalConsole = {
      error: console.error,
      log: console.log,
      warn: console.warn,
    }
    const state = { hasErrorOutput: false }
    console.log = (...values: unknown[]) => writeOutput('stdout', values)
    console.warn = (...values: unknown[]) => writeOutput('stderr', values)
    console.error = (...values: unknown[]) => {
      state.hasErrorOutput = true
      writeOutput('stderr', values)
    }

    try {
      await runTerminalDemo(event.data.demoId, event.data.command)
      workerScope.postMessage({
        status: state.hasErrorOutput ? 'error' : 'success',
        type: 'complete',
      })
    } catch (error) {
      writeOutput('stderr', [error])
      workerScope.postMessage({ status: 'error', type: 'complete' })
    } finally {
      console.error = originalConsole.error
      console.log = originalConsole.log
      console.warn = originalConsole.warn
    }
  },
)
