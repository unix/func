import type { APIRoute } from 'astro'

const createRobotsTxt = (sitemapUrl: URL) => {
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl.href}\n`
}

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('The site URL is required to generate robots.txt')
  const sitemapUrl = new URL('/sitemap-index.xml', site)

  return new Response(createRobotsTxt(sitemapUrl), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
