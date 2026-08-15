import type { ContainerOptions } from '../../containers/container'

export type CompletionFallback = 'file' | 'none'

export type CompletionItemKind = 'command' | 'option' | 'value'

export type CompletionShell = 'bash' | 'fish' | 'powershell' | 'zsh'

export interface CompletionItem {
  readonly description?: string
  readonly kind: CompletionItemKind
  readonly value: string
}

export interface CompletionRequest {
  readonly args: readonly string[]
  readonly incomplete: string
}

export interface CompletionResult {
  readonly appendSpace: boolean
  readonly fallback: CompletionFallback
  readonly items: readonly CompletionItem[]
}

export interface CompletionRunOptions extends ContainerOptions {
  name: string
}
