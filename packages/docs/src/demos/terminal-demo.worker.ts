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

const workerScope = globalThis as unknown as TerminalDemoWorkerScope

const formatValue = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message

  try {
    const formatted = JSON.stringify(value, null, 2) as string | undefined
    return formatted ?? String(value)
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

workerScope.addEventListener('message', async event => {
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
})
