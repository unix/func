interface MarkdownSource {
  path: string
  source: string
}

const pageSources = import.meta.glob<string>('../pages/**/*.mdx', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const englishErrorSources = import.meta.glob<string>('../content/errors/*.mdx', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const chineseErrorSources = import.meta.glob<string>(
  '../content/errors/zh-cn/*.mdx',
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
)

export const markdownSources: MarkdownSource[] = [
  ...Object.entries(pageSources).map(([file, source]) => ({
    path: file.replace('../pages/', '').replace(/\.mdx$/, ''),
    source,
  })),
  ...Object.entries(englishErrorSources).map(([file, source]) => ({
    path: `errors/${file
      .split('/')
      .at(-1)
      ?.replace(/\.mdx$/, '')}`,
    source,
  })),
  ...Object.entries(chineseErrorSources).map(([file, source]) => ({
    path: `zh-cn/errors/${file
      .split('/')
      .at(-1)
      ?.replace(/\.mdx$/, '')}`,
    source,
  })),
]
