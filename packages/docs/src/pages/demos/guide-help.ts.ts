import source from '@/demos/fixtures/guide-help.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="guide-help.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
