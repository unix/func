import { systemErrorCodes } from '@func/shared/system-errors'
import { describe, expect, test } from 'vitest'
import { handleRequest } from '../src'

const NOT_FOUND_CACHE_CONTROL = 'public, max-age=86400'
const REDIRECT_CACHE_CONTROL = 'public, max-age=604800'

const requestKey = (request: RequestInfo | URL): string => {
  if (request instanceof Request) return request.url

  return request.toString()
}

class MemoryCache implements Pick<Cache, 'match' | 'put'> {
  readonly writes: string[] = []
  readonly responses = new Map<string, Response>()

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.responses.get(requestKey(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = requestKey(request)
    this.writes.push(key)
    this.responses.set(key, response.clone())
  }
}

const testContext = (): {
  ctx: Pick<ExecutionContext, 'waitUntil'>
  flush: () => Promise<void>
} => {
  const pending: Promise<unknown>[] = []

  return {
    ctx: {
      waitUntil(promise) {
        pending.push(promise)
      },
    },
    async flush() {
      await Promise.all(pending)
    },
  }
}

const executeRequest = async (
  path: string,
  init?: RequestInit,
  cache = new MemoryCache(),
): Promise<{ cache: MemoryCache; response: Response }> => {
  const { ctx, flush } = testContext()
  const request = new Request(`https://f.witt.im${path}`, init)
  const response = await handleRequest(request, cache, ctx)
  await flush()

  return { cache, response }
}

describe('alias worker', () => {
  test('redirects every shared system error without the common prefix', async () => {
    for (const code of systemErrorCodes) {
      const alias = code.replace('F_SYSTEM_', '').toLowerCase()
      const { response } = await executeRequest(`/${alias}`)

      expect(response.status).toBe(308)
      expect(response.headers.get('location')).toBe(
        `https://func.witt.im/errors/${code}`,
      )
      expect(response.headers.get('cache-control')).toBe(REDIRECT_CACHE_CONTROL)
    }
  })

  test('normalizes case and query strings into one seven-day cache entry', async () => {
    const cache = new MemoryCache()
    const first = await executeRequest(
      '/expected_array_param?source=first',
      undefined,
      cache,
    )
    const second = await executeRequest(
      '/EXPECTED_ARRAY_PARAM?source=second',
      undefined,
      cache,
    )

    expect(first.response.status).toBe(308)
    expect(second.response.status).toBe(308)
    expect(cache.writes).toEqual(['https://f.witt.im/EXPECTED_ARRAY_PARAM'])
  })

  test('returns and caches a 404 for an unknown GET request for 24 hours', async () => {
    const { cache, response } = await executeRequest('/unknown_error')

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found')
    expect(response.headers.get('cache-control')).toBe(NOT_FOUND_CACHE_CONTROL)
    expect(cache.writes).toEqual(['https://f.witt.im/UNKNOWN_ERROR'])
  })

  test('returns a cached 404 for every non-GET method, including known aliases', async () => {
    const { cache, response } = await executeRequest('/expected_array_param', {
      method: 'POST',
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe(NOT_FOUND_CACHE_CONTROL)
    expect(cache.writes).toEqual([
      'https://f.witt.im/EXPECTED_ARRAY_PARAM?__error_alias_method=POST',
    ])
  })

  test('does not accept the common system error prefix in the alias', async () => {
    const { response } = await executeRequest('/F_SYSTEM_EXPECTED_ARRAY_PARAM')

    expect(response.status).toBe(404)
  })
})
