import { markdownSources } from '@/lib/markdown'
import type { APIRoute, GetStaticPaths } from 'astro'

interface Props {
  filename: string
  source: string
}

export const getStaticPaths = (() => {
  return markdownSources.map(page => ({
    params: { markdown: page.path },
    props: {
      filename: `${page.path.split('/').at(-1)}.md`,
      source: page.source,
    },
  }))
}) satisfies GetStaticPaths

export const GET: APIRoute<Props> = ({ props }) => {
  return new Response(props.source, {
    headers: {
      'Content-Disposition': `inline; filename="${props.filename}"`,
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
