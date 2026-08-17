import type { ProviderOverride } from '../../testing/provider-overrides'
import type { HttpRequestInput, HttpRequestOptions } from '../interfaces'
import { HttpClient } from '../runtime'

export interface HttpMockCall {
  readonly input: HttpRequestInput
  readonly method: string
  readonly options: HttpRequestOptions
  readonly url: string
}

export interface HttpMockExpectation {
  reject(error: Error): void
  reply(body?: HttpMockBody, init?: ResponseInit): void
}

export type HttpMockBody = ConstructorParameters<typeof Response>[0]

export interface HttpMock {
  readonly calls: readonly HttpMockCall[]
  expect(method: string, url: string): HttpMockExpectation
  override(): ProviderOverride
  verify(): void
}

interface ExpectedHttpRequest {
  readonly method: string
  outcome?: HttpMockOutcome
  readonly url: string
}

type HttpMockOutcome =
  | { readonly error: Error; readonly type: 'reject' }
  | {
      readonly body: HttpMockBody
      readonly init: ResponseInit
      readonly type: 'reply'
    }

interface HttpMockConsumer {
  consume(call: HttpMockCall): HttpMockOutcome
}

class MockHttpClient extends HttpClient {
  constructor(private readonly controller: HttpMockConsumer) {
    super()
  }

  override async request(
    input: HttpRequestInput,
    options: HttpRequestOptions = {},
  ): Promise<Response> {
    const outcome = this.controller.consume(httpCall(input, options))
    if (outcome.type === 'reject') throw outcome.error
    return new Response(outcome.body, outcome.init)
  }

  override onDispose(): void {}
}

class HttpMockController implements HttpMock {
  private readonly recordedCalls: HttpMockCall[] = []
  private readonly expectations: ExpectedHttpRequest[] = []

  get calls(): readonly HttpMockCall[] {
    return Object.freeze(this.recordedCalls.slice())
  }

  expect(method: string, url: string): HttpMockExpectation {
    assertExpectation(method, url)
    const expected: ExpectedHttpRequest = {
      method: method.toUpperCase(),
      url,
    }
    this.expectations.push(expected)

    return {
      reject: error => {
        if (!(error instanceof Error)) {
          throw new TypeError('HTTP mock rejection must be an Error.')
        }
        setOutcome(expected, { error, type: 'reject' })
      },
      reply: (body = null, init = {}) => {
        assertResponseInit(init)
        setOutcome(expected, {
          body,
          init: Object.freeze({ ...init }),
          type: 'reply',
        })
      },
    }
  }

  override(): ProviderOverride {
    return {
      provide: HttpClient,
      useFactory: () => new MockHttpClient(this),
    }
  }

  verify(): void {
    if (!this.expectations.length) return
    const next = this.expectations[0]
    throw new Error(
      `Expected ${this.expectations.length} more HTTP request(s); next was ${formatRequest(next)}.`,
    )
  }

  consume(call: HttpMockCall): HttpMockOutcome {
    this.recordedCalls.push(call)
    const expected = this.expectations.at(0)
    if (!expected) {
      throw new Error(`Unexpected HTTP request: ${formatRequest(call)}.`)
    }
    if (!matches(expected, call)) {
      throw new Error(
        `Unexpected HTTP request: received ${formatRequest(call)}, expected ${formatRequest(expected)}.`,
      )
    }
    if (!expected.outcome) {
      throw new Error(
        `HTTP expectation ${formatRequest(expected)} does not have a reply or rejection.`,
      )
    }

    this.expectations.shift()
    return expected.outcome
  }
}

export const createHttpMock = (): HttpMock => new HttpMockController()

const httpCall = (
  input: HttpRequestInput,
  options: HttpRequestOptions,
): HttpMockCall => {
  const method = (
    options.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase()
  const url =
    input instanceof Request ? input.url : input instanceof URL ? input.href : input
  return Object.freeze({
    input,
    method,
    options: Object.freeze({ ...options }),
    url,
  })
}

const matches = (expected: ExpectedHttpRequest, actual: HttpMockCall): boolean =>
  expected.method === actual.method && expected.url === actual.url

const setOutcome = (expected: ExpectedHttpRequest, outcome: HttpMockOutcome) => {
  if (expected.outcome) {
    throw new Error(
      `HTTP expectation ${formatRequest(expected)} already has an outcome.`,
    )
  }
  expected.outcome = outcome
}

const assertExpectation = (method: string, url: string) => {
  if (typeof method !== 'string' || !method.length) {
    throw new TypeError('HTTP mock method must be a non-empty string.')
  }
  if (typeof url !== 'string' || !url.length) {
    throw new TypeError('HTTP mock URL must be a non-empty string.')
  }
}

const assertResponseInit = (init: unknown) => {
  if (!init || typeof init !== 'object') {
    throw new TypeError('HTTP mock response init must be an object.')
  }
}

const formatRequest = (request: { method: string; url: string }): string =>
  `${request.method} ${request.url}`
