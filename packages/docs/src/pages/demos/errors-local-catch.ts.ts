import source from '@/demos/fixtures/errors-local-catch.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="errors-local-catch.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
