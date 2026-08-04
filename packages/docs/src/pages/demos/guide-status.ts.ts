import source from '@/demos/fixtures/guide-status.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="guide-status.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
