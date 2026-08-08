export type DocPage =
  | '/'
  | 'guide'
  | 'guide/agent-setup'
  | 'guide/existing-project'
  | 'concepts'
  | 'use-cases'
  | 'commands'
  | 'options'
  | 'parameters'
  | 'tooling'
  | 'ecosystem'
  | 'runtime'
  | 'error-handler'
  | 'errors'
  | 'apis'
  | 'glossary'
  | 'changelog'

export type Locale = 'en' | 'zh-cn'

export interface DocFrontmatter {
  description: string
  lastModified: string
  title: string
}

export const siteName = 'FUNC'
export const siteUrl = 'https://func.witt.im'
export const defaultLocale: Locale = 'en'
export const locales: Locale[] = [defaultLocale, 'zh-cn']

const siteSlogans: Record<Locale, string> = {
  en: 'Tiny typed CLI framework',
  'zh-cn': '轻量类型化 CLI 框架',
}

const navLabels: Record<Locale, Record<DocPage, string>> = {
  en: {
    '/': 'Introduction',
    guide: 'Quick Start',
    'guide/agent-setup': 'Work with func using an Agent',
    'guide/existing-project': 'Existing Projects',
    concepts: 'Concepts',
    'use-cases': 'Examples',
    commands: 'Commands',
    options: 'Field Options',
    parameters: 'Parameters',
    tooling: 'Tooling',
    ecosystem: 'Ecosystem Guide',
    runtime: 'Runtime',
    'error-handler': 'Error Handling',
    errors: 'Errors',
    apis: 'API Reference',
    glossary: 'Glossary',
    changelog: 'Changelog',
  },
  'zh-cn': {
    '/': '介绍',
    guide: '快速起步',
    'guide/agent-setup': '使用 Agent 操作 func',
    'guide/existing-project': '已有项目如何接入',
    concepts: '概念',
    'use-cases': '示例',
    commands: '命令',
    options: '字段选项',
    parameters: '参数注入',
    tooling: '工具链',
    ecosystem: '生态选型',
    runtime: '深入了解运行时',
    'error-handler': '错误处理',
    errors: '错误索引',
    apis: 'API 参考',
    glossary: '术语索引',
    changelog: '更新日志',
  },
}

const navGroups: Record<Locale, { label?: string; pages: DocPage[] }[]> = {
  en: [
    { pages: ['/'] },
    {
      label: 'Guide',
      pages: ['guide', 'guide/agent-setup', 'guide/existing-project'],
    },
    {
      label: 'Documentation',
      pages: [
        'concepts',
        'commands',
        'options',
        'parameters',
        'error-handler',
        'tooling',
        'runtime',
      ],
    },
    {
      label: 'Reference',
      pages: ['errors', 'glossary', 'apis', 'changelog'],
    },
    {
      label: 'Further Reading',
      pages: ['use-cases', 'ecosystem'],
    },
  ],
  'zh-cn': [
    { pages: ['/'] },
    {
      label: '指南',
      pages: ['guide', 'guide/agent-setup', 'guide/existing-project'],
    },
    {
      label: '核心文档',
      pages: [
        'concepts',
        'commands',
        'options',
        'parameters',
        'error-handler',
        'tooling',
        'runtime',
      ],
    },
    {
      label: '参考资料',
      pages: ['errors', 'glossary', 'apis', 'changelog'],
    },
    {
      label: '扩展阅读',
      pages: ['use-cases', 'ecosystem'],
    },
  ],
}

export const siteTitle = `${siteName} - ${siteSlogans[defaultLocale]}`

export const getSiteTitle = (locale: Locale = defaultLocale) => {
  return `${siteName} - ${siteSlogans[locale]}`
}

export const getSiteSlogan = (locale: Locale = defaultLocale) => {
  return siteSlogans[locale]
}

export const getLocalePath = (page: DocPage, locale: Locale = defaultLocale) => {
  const path = page === '/' ? '/' : `/${page}`
  if (locale === defaultLocale) return path
  return page === '/' ? `/${locale}` : `/${locale}${path}`
}

export const getNavGroups = (locale: Locale = defaultLocale) => {
  return navGroups[locale].map(group => ({
    label: group.label,
    items: group.pages.map(id => ({
      id,
      label: navLabels[locale][id],
      href: getLocalePath(id, locale),
    })),
  }))
}

export const getLanguageSwitch = (page: DocPage, locale: Locale = defaultLocale) => {
  const targetLocale: Locale = locale === defaultLocale ? 'zh-cn' : defaultLocale

  return {
    href: getLocalePath(page, targetLocale),
    label: targetLocale === defaultLocale ? 'EN' : '中文',
    locale: targetLocale,
  }
}

export const getMarkdownPath = (page: DocPage, locale: Locale = defaultLocale) => {
  const slug = page === '/' ? 'index' : page
  return locale === defaultLocale ? `/${slug}.md` : `/${locale}/${slug}.md`
}

export const getEditUrl = (page: DocPage, locale: Locale = defaultLocale) => {
  const slug = page === '/' ? 'index' : page
  const localePath = locale === defaultLocale ? '' : `${locale}/`
  return `https://github.com/unix/func/edit/main/packages/docs/src/pages/${localePath}${slug}.mdx`
}
