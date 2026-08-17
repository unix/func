import type { Environment } from '../../../shared/environment'

export interface PtyDisposable {
  dispose(): void
}

export interface PtyExitEvent {
  readonly exitCode: number
  readonly signal?: number
}

export interface PtyProcess {
  readonly pid: number
  kill(signal?: string): void
  onData(listener: (data: string) => void): PtyDisposable
  onExit(listener: (event: PtyExitEvent) => void): PtyDisposable
  resize(columns: number, rows: number): void
  write(data: string): void
}

export interface PtySpawnOptions {
  readonly cols: number
  readonly cwd: string
  readonly env: Environment
  readonly name: string
  readonly rows: number
}

export interface PtyAdapter {
  spawn(file: string, args: string[], options: PtySpawnOptions): PtyProcess
}
