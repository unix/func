import source from '@/demos/fixtures/json-output.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="json-output.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
