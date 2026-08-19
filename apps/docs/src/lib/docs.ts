export type DocPage =
  | '/'
  | 'guide'
  | 'guide/agent-setup'
  | 'concepts'
  | 'modules'
  | 'use-cases'
  | 'commands'
  | 'options'
  | 'shared-fields'
  | 'parameters'
  | 'input-output'
  | 'custom-decorators'
  | 'tooling'
  | 'micro-apps'
  | 'ecosystem'
  | 'interactive-apps'
  | 'runtime'
  | 'capabilities/json-output'
  | 'capabilities/help'
  | 'capabilities/invoke'
  | 'capabilities/testing'
  | 'capabilities/config'
  | 'capabilities/log'
  | 'capabilities/network'
  | 'capabilities/completion'
  | 'capabilities/signals'
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
    'guide/agent-setup': 'Work with Agent',
    concepts: 'Concepts',
    modules: 'Modules',
    'use-cases': 'Examples',
    commands: 'Commands',
    options: 'Field Options',
    'shared-fields': 'Shared Fields',
    parameters: 'Parameter Injection',
    'input-output': 'Input and Output',
    'custom-decorators': 'Custom Decorators',
    tooling: 'Tooling',
    'micro-apps': 'Micro Applications',
    ecosystem: 'Ecosystem Guide',
    'interactive-apps': 'Interactive Applications',
    runtime: 'Runtime Internals',
    'capabilities/json-output': 'JSON Output',
    'capabilities/help': 'Help',
    'capabilities/invoke': 'Imperative Invocation',
    'capabilities/testing': 'Testing',
    'capabilities/config': 'Configuration',
    'capabilities/log': 'Logging',
    'capabilities/network': 'Networking',
    'capabilities/completion': 'Shell Completion',
    'capabilities/signals': 'Process Signals',
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
    concepts: '概念',
    modules: '模块',
    'use-cases': '示例',
    commands: '命令',
    options: '字段选项',
    'shared-fields': '共享字段',
    parameters: '参数注入',
    'input-output': '输入与输出',
    'custom-decorators': '自定义装饰器',
    tooling: '工具链',
    'micro-apps': '微型应用',
    ecosystem: '生态选型',
    'interactive-apps': '交互式应用',
    runtime: '深入了解运行时',
    'capabilities/json-output': 'JSON 输出',
    'capabilities/help': '帮助',
    'capabilities/invoke': '命令式调用',
    'capabilities/testing': '测试',
    'capabilities/config': '配置文件',
    'capabilities/log': '日志',
    'capabilities/network': '网络',
    'capabilities/completion': 'Shell 补全',
    'capabilities/signals': '进程信号',
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
      pages: ['guide', 'guide/agent-setup'],
    },
    {
      label: 'Quick Start',
      pages: ['commands', 'options', 'parameters', 'error-handler', 'use-cases'],
    },
    {
      label: 'Deep Dive',
      pages: [
        'concepts',
        'modules',
        'shared-fields',
        'input-output',
        'custom-decorators',
        'tooling',
        'runtime',
      ],
    },
    {
      label: 'Optional Capabilities',
      pages: ['capabilities/signals'],
    },
    {
      label: 'Reference',
      pages: ['errors', 'glossary', 'apis', 'changelog'],
    },
    {
      label: 'Further Reading',
      pages: ['micro-apps', 'ecosystem', 'interactive-apps'],
    },
  ],
  'zh-cn': [
    { pages: ['/'] },
    {
      label: '指南',
      pages: ['guide', 'guide/agent-setup'],
    },
    {
      label: '快速入门',
      pages: [
        'commands',
        'options',
        'parameters',
        'error-handler',
        'capabilities/testing',
        'use-cases',
      ],
    },
    {
      label: '深入学习',
      pages: [
        'concepts',
        'modules',
        'shared-fields',
        'input-output',
        'custom-decorators',
        'tooling',
        'runtime',
      ],
    },
    {
      label: '可选能力',
      pages: [
        'capabilities/json-output',
        'capabilities/help',
        'capabilities/invoke',
        'capabilities/config',
        'capabilities/log',
        'capabilities/network',
        'capabilities/completion',
        'capabilities/signals',
      ],
    },
    {
      label: '参考资料',
      pages: ['errors', 'glossary', 'apis', 'changelog'],
    },
    {
      label: '扩展阅读',
      pages: ['micro-apps', 'ecosystem', 'interactive-apps'],
    },
  ],
}

const languageSwitchFallbacks: Partial<
  Record<DocPage, Partial<Record<Locale, DocPage>>>
> = {
  'capabilities/json-output': { en: 'tooling' },
  'capabilities/help': { en: 'tooling' },
  'capabilities/invoke': { en: 'tooling' },
  'capabilities/testing': { en: 'tooling' },
  'capabilities/config': { en: 'tooling' },
  'capabilities/log': { en: 'tooling' },
  'capabilities/network': { en: 'tooling' },
  'capabilities/completion': { en: 'tooling' },
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
  const targetPage = languageSwitchFallbacks[page]?.[targetLocale] ?? page

  return {
    href: getLocalePath(targetPage, targetLocale),
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
  return `https://github.com/unix/func/edit/main/apps/docs/src/pages/${localePath}${slug}.mdx`
}
