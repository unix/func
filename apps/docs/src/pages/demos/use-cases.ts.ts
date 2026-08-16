import source from '@/demos/fixtures/use-cases.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="use-cases.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
