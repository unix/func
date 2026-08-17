import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  CommandMajor,
  Context,
  ErrorScope,
  Handler,
  Injectable,
  Module,
  formatExceptionCode,
} from '../src'
import { HTTP_RUNTIME, HttpClient, HttpModule } from '../src/subpath/http'
import { bindHttpClient } from '../src/subpath/http/runtime'
import { createHttpMock } from '../src/subpath/http/testing'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from './_test'

test.sequential('should use HttpClient from a class-first API module', async () => {
  const server = createServer((request, response) => {
    response.writeHead(201, {
      'content-type': 'application/json',
      'x-request-method': request.method,
    })
    response.end(JSON.stringify({ accepted: true }))
  })
  const url = await listen(server)

  try {
    @Injectable()
    class GitHubApi {
      constructor(private readonly http: HttpClient) {}

      async createRelease() {
        const response = await this.http.request(`${url}/releases`, {
          method: 'POST',
        })
        return {
          body: await response.json(),
          method: response.headers.get('x-request-method'),
          status: response.status,
        }
      }
    }

    @Module({
      exports: [GitHubApi],
      imports: [HttpModule],
      providers: [GitHubApi],
    })
    class GitHubModule {}

    @CommandMajor()
    class Major {
      constructor(private readonly github: GitHubApi) {}

      @Handler()
      run() {
        return this.github.createRelease()
      }
    }

    @Module({ commands: [Major], imports: [GitHubModule] })
    class AppModule {}

    const invocation = await createTestingApp(AppModule).invoke()
    expect(invocation.error).toBeUndefined()
    expect(invocation.result).toEqual({
      body: { accepted: true },
      method: 'POST',
      status: 201,
    })
  } finally {
    await close(server)
  }
})

test.sequential('should enforce HTTP abort and timeout controls', async () => {
  let acceptRequest = () => {}
  const accepted = new Promise<void>(resolve => {
    acceptRequest = resolve
  })
  const server = createServer(() => acceptRequest())
  const url = await listen(server)

  try {
    const timeoutClient = boundHttpClient()
    await expect(
      timeoutClient.request(url, { timeoutMs: 20 }),
    ).rejects.toMatchObject({
      code: httpRuntimeErrorCode(HTTP_RUNTIME.TIMEOUT),
    })

    const client = boundHttpClient()
    const request = client.request(url)
    await accepted
    client.onDispose()
    await expect(request).rejects.toMatchObject({
      code: httpRuntimeErrorCode(HTTP_RUNTIME.ABORTED),
    })
  } finally {
    await close(server)
  }
})

test('should require HttpModule and validate request options', async () => {
  expect(() => new HttpClient().request('https://example.com')).toThrow(
    expect.objectContaining({
      code: httpRuntimeErrorCode(HTTP_RUNTIME.NOT_REGISTERED),
    }),
  )
  await expect(
    boundHttpClient().request('https://example.com', { timeoutMs: 0 }),
  ).rejects.toMatchObject({
    code: httpRuntimeErrorCode(HTTP_RUNTIME.INVALID_OPTIONS),
    details: { option: 'timeoutMs', value: 0 },
  })
})

test('should override HttpClient with a strict HTTP mock', async () => {
  const http = createHttpMock()
  http
    .expect('GET', 'https://api.github.test/repos/unix/func')
    .reply(JSON.stringify({ stars: 42 }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })

  @Injectable()
  class GitHubApi {
    constructor(private readonly client: HttpClient) {}

    async repository() {
      const response = await this.client.request(
        'https://api.github.test/repos/unix/func',
      )
      return response.json()
    }
  }

  @CommandMajor()
  class Major {
    constructor(private readonly github: GitHubApi) {}

    @Handler()
    run() {
      return this.github.repository()
    }
  }

  @Module({
    commands: [Major],
    imports: [HttpModule],
    providers: [GitHubApi],
  })
  class AppModule {}

  const invocation = await createTestingApp(AppModule, {
    overrides: [http.override()],
  }).invoke()
  expect(invocation.error).toBeUndefined()
  expect(invocation.result).toEqual({ stars: 42 })
  expect(http.calls).toHaveLength(1)
  expect(http.calls[0]).toMatchObject({
    method: 'GET',
    url: 'https://api.github.test/repos/unix/func',
  })
  expect(() => http.verify()).not.toThrow()
})

const boundHttpClient = (signal = new AbortController().signal): HttpClient =>
  bindHttpClient(
    new HttpClient(),
    new Context(
      [],
      {
        stderr: process.stderr,
        stdin: process.stdin,
        stdout: process.stdout,
      },
      process.cwd(),
      signal,
    ),
  )

const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!isAddressInfo(address)) {
    throw new TypeError('Expected an HTTP server address.')
  }
  return `http://127.0.0.1:${address.port}`
}

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

const httpRuntimeErrorCode = (code: HTTP_RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const isAddressInfo = (value: unknown): value is AddressInfo =>
  typeof value === 'object' &&
  value !== null &&
  'port' in value &&
  typeof value.port === 'number'
