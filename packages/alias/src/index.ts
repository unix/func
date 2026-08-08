import { systemErrorCodes, type SystemErrorCode } from '@func/shared/system-errors'

const SYSTEM_ERROR_PREFIX = 'F_SYSTEM_'
const NOT_FOUND_CACHE_TTL_SECONDS = 24 * 60 * 60
const REDIRECT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
const METHOD_CACHE_KEY_PARAM = '__error_alias_method'
const ERROR_DOCUMENTATION_BASE_URL = 'https://func.witt.im/errors'

const systemErrorByAlias: ReadonlyMap<string, SystemErrorCode> = new Map(
  systemErrorCodes.map(code => {
    return [code.slice(SYSTEM_ERROR_PREFIX.length), code] as const
  }),
)

type ErrorAliasCache = Pick<Cache, 'match' | 'put'>
type WaitUntilContext = Pick<ExecutionContext, 'waitUntil'>

const normalizedAlias = (pathname: string): string => {
  return pathname.slice(1).toUpperCase()
}

const cacheKey = (request: Request, alias: string): Request => {
  const url = new URL(request.url)
  url.pathname = `/${alias}`
  url.search = ''

  if (request.method !== 'GET') {
    url.searchParams.set(METHOD_CACHE_KEY_PARAM, request.method.toUpperCase())
  }

  return new Request(url, { method: 'GET' })
}

const cacheControl = (ttlSeconds: number): string => {
  return `public, max-age=${ttlSeconds}`
}

const notFoundResponse = (): Response => {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': cacheControl(NOT_FOUND_CACHE_TTL_SECONDS),
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

const redirectResponse = (code: SystemErrorCode): Response => {
  return new Response(null, {
    status: 308,
    headers: {
      'Cache-Control': cacheControl(REDIRECT_CACHE_TTL_SECONDS),
      Location: `${ERROR_DOCUMENTATION_BASE_URL}/${code}`,
    },
  })
}

const responseForRequest = (request: Request, alias: string): Response => {
  if (request.method !== 'GET') return notFoundResponse()

  const code = systemErrorByAlias.get(alias)
  if (!code) return notFoundResponse()

  return redirectResponse(code)
}

export const handleRequest = async (
  request: Request,
  cache: ErrorAliasCache,
  ctx: WaitUntilContext,
): Promise<Response> => {
  const alias = normalizedAlias(new URL(request.url).pathname)
  const key = cacheKey(request, alias)
  const cachedResponse = await cache.match(key)
  if (cachedResponse) return cachedResponse

  const response = responseForRequest(request, alias)
  ctx.waitUntil(cache.put(key, response.clone()))

  return response
}

export default {
  fetch(request, _env, ctx) {
    return handleRequest(request, caches.default, ctx)
  },
} satisfies ExportedHandler
