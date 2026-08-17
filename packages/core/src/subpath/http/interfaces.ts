import type { ExceptionOptions } from '../../shared/errors'

export type HttpRequestInput = Request | URL | string

export interface HttpRequestOptions extends RequestInit {
  timeoutMs?: number
}

export type HttpExceptionOptions = Omit<ExceptionOptions, 'name' | 'scope'>
