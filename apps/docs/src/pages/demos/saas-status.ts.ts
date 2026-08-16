import source from '@/demos/fixtures/saas-status.demo.ts?raw'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  return new Response(source, {
    headers: {
      'Content-Disposition': 'inline; filename="saas-status.ts"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
