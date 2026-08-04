interface MarkdownSource {
  path: string
  source: string
}

const pageSources = import.meta.glob<string>('../pages/**/*.mdx', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const markdownSources: MarkdownSource[] = Object.entries(pageSources).map(
  ([file, source]) => ({
    path: file.replace('../pages/', '').replace(/\.mdx$/, ''),
    source,
  }),
)
