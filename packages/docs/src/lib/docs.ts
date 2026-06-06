export type DocPage =
  | '/'
  | 'guide'
  | 'concepts'
  | 'use-cases'
  | 'commands'
  | 'options'
  | 'parameters'
  | 'tooling'
  | 'errors'
  | 'apis'

export type Locale = 'en' | 'zh-cn'

export const siteName = 'FUNC'
export const defaultLocale: Locale = 'en'
export const locales: Locale[] = [defaultLocale, 'zh-cn']

const siteSlogans: Record<Locale, string> = {
  en: 'Tiny typed CLI framework',
  'zh-cn': '轻量类型化 CLI 框架',
}

const navLabels: Record<Locale, Record<DocPage, string>> = {
  en: {
    '/': '/',
    guide: 'Guide',
    concepts: 'Core Concepts',
    'use-cases': 'Use Cases',
    commands: 'Commands',
    options: 'Field Options',
    parameters: 'Parameters',
    tooling: 'Tooling',
    errors: 'Errors',
    apis: 'API Reference',
  },
  'zh-cn': {
    '/': '/',
    guide: '指南',
    concepts: '核心概念',
    'use-cases': '使用案例',
    commands: '命令',
    options: '字段选项',
    parameters: '参数注入',
    tooling: '工具链',
    errors: '错误处理',
    apis: 'API 参考',
  },
}

const navPages: DocPage[] = [
  '/',
  'guide',
  'concepts',
  'options',
  'parameters',
  'errors',
  'tooling',
  'use-cases',
  'apis',
]

export const siteTitle = `${siteName} - ${siteSlogans[defaultLocale]}`

export function getSiteTitle(locale: Locale = defaultLocale) {
  return `${siteName} - ${siteSlogans[locale]}`
}

export function getLocalePath(page: DocPage, locale: Locale = defaultLocale) {
  const path = page === '/' ? '/' : `/${page}`

  if (locale === defaultLocale) {
    return path
  }

  return page === '/' ? `/${locale}/` : `/${locale}${path}`
}

export function getNavItems(locale: Locale = defaultLocale) {
  return navPages.map(id => ({
    id,
    label: navLabels[locale][id],
    href: getLocalePath(id, locale),
  }))
}

export function getLanguageSwitch(page: DocPage, locale: Locale = defaultLocale) {
  const targetLocale: Locale = locale === defaultLocale ? 'zh-cn' : defaultLocale

  return {
    href: getLocalePath(page, targetLocale),
    label: targetLocale === defaultLocale ? 'EN' : '中文',
  }
}
