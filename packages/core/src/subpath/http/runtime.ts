import { RUNTIME } from '@func/contracts/http-errors'
import type { OnDispose } from '../../di/lifecycle'
import type { Context } from '../../runtime/context'
import { ErrorScope, Exception } from '../../shared/errors'
import type {
  HttpExceptionOptions,
  HttpRequestInput,
  HttpRequestOptions,
} from './interfaces'

interface HttpBinding {
  context: Context
  requests: Set<AbortController>
}

interface NormalizedRequest {
  controller: AbortController
  request: Request
  timeoutSignal?: AbortSignal
}

type AssertHttpRequestOptions = (
  options: unknown,
) => asserts options is HttpRequestOptions

const httpStates = new WeakMap<HttpClient, HttpBinding>()

export class HttpException extends Exception<RUNTIME> {
  constructor(code: RUNTIME, options: HttpExceptionOptions | string = {}) {
    const normalized = typeof options === 'string' ? { message: options } : options
    super(code, {
      ...normalized,
      name: 'HttpException',
      scope: ErrorScope.RUNTIME,
    })
  }
}

export class HttpClient implements OnDispose {
  request(
    input: HttpRequestInput,
    options: HttpRequestOptions = {},
  ): Promise<Response> {
    return executeRequest(httpState(this), input, options)
  }

  onDispose(): void {
    const state = httpStates.get(this)
    if (!state) return
    state.requests.forEach(controller => controller.abort())
    state.requests.clear()
  }
}

export const bindHttpClient = (
  instance: HttpClient,
  context: Context,
): HttpClient => {
  httpStates.set(instance, {
    context,
    requests: new Set(),
  })
  return instance
}

const executeRequest = async (
  binding: HttpBinding,
  input: HttpRequestInput,
  options: HttpRequestOptions,
): Promise<Response> => {
  const normalized = normalizeRequest(binding, input, options)
  binding.requests.add(normalized.controller)

  try {
    const response = await fetch(normalized.request)
    if (!response.body) binding.requests.delete(normalized.controller)
    return response
  } catch (error) {
    binding.requests.delete(normalized.controller)
    throw requestError(error, normalized)
  }
}

const normalizeRequest = (
  binding: HttpBinding,
  input: HttpRequestInput,
  options: HttpRequestOptions,
): NormalizedRequest => {
  assertRequestOptions(options)
  const { signal: requestSignal, timeoutMs, ...requestOptions } = options
  const controller = new AbortController()
  const timeoutSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  const signals = [binding.context.signal, controller.signal]
  if (input instanceof Request) signals.push(input.signal)
  if (requestSignal) signals.push(requestSignal)
  if (timeoutSignal) signals.push(timeoutSignal)
  const signal = AbortSignal.any(signals)
  if (signal.aborted) throw abortedRequest(timeoutSignal)

  try {
    return {
      controller,
      request: new Request(input, { ...requestOptions, signal }),
      timeoutSignal,
    }
  } catch (error) {
    const cause = error instanceof Error ? error : undefined
    throw new HttpException(RUNTIME.INVALID_OPTIONS, {
      cause,
      message: cause?.message ?? 'HTTP request options are invalid.',
    })
  }
}

const assertRequestOptions: AssertHttpRequestOptions = options => {
  if (!options || typeof options !== 'object') {
    throw new HttpException(
      RUNTIME.INVALID_OPTIONS,
      'HTTP request options must be an object.',
    )
  }
  const timeoutMs = readProperty(options, 'timeoutMs')
  if (
    timeoutMs === undefined ||
    (Number.isSafeInteger(timeoutMs) &&
      typeof timeoutMs === 'number' &&
      timeoutMs > 0)
  ) {
    return
  }

  throw new HttpException(RUNTIME.INVALID_OPTIONS, {
    details: { option: 'timeoutMs', value: timeoutMs },
    message: 'HTTP timeoutMs must be a positive safe integer.',
  })
}

const requestError = (error: unknown, request: NormalizedRequest): HttpException => {
  if (request.timeoutSignal?.aborted)
    return new HttpException(RUNTIME.TIMEOUT, 'HTTP request timed out.')
  if (request.request.signal.aborted) return abortedRequest()
  const cause = error instanceof Error ? error : undefined
  return new HttpException(RUNTIME.NETWORK, {
    cause,
    details: { method: request.request.method },
    message: cause?.message ?? 'HTTP request failed.',
  })
}

const abortedRequest = (timeoutSignal?: AbortSignal): HttpException =>
  timeoutSignal?.aborted
    ? new HttpException(RUNTIME.TIMEOUT, 'HTTP request timed out.')
    : new HttpException(RUNTIME.ABORTED, 'HTTP request was aborted.')

const httpState = (instance: HttpClient): HttpBinding => {
  const state = httpStates.get(instance)
  if (state) return state
  throw new HttpException(
    RUNTIME.NOT_REGISTERED,
    'HttpClient must be provided by HttpModule.',
  )
}

const readProperty = (value: object, key: PropertyKey): unknown =>
  Reflect.get(value, key)
