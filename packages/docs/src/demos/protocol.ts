export const terminalDemoIds = [
  'errors-local-catch',
  'guide-help',
  'guide-status',
  'saas-status',
  'use-cases',
] as const

export type TerminalDemoId = (typeof terminalDemoIds)[number]
export type TerminalDemoStream = 'stderr' | 'stdout'

export interface TerminalDemoRunMessage {
  command: string
  demoId: TerminalDemoId
  type: 'run'
}

export interface TerminalDemoOutputMessage {
  stream: TerminalDemoStream
  text: string
  type: 'output'
}

export interface TerminalDemoCompleteMessage {
  status: 'error' | 'success'
  type: 'complete'
}

export type TerminalDemoWorkerMessage =
  TerminalDemoCompleteMessage | TerminalDemoOutputMessage
