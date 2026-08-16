import {
  ErrorScope,
  SYSTEM,
  formatErrorCode,
  type SystemErrorCode,
} from '@func/contracts/core-errors'
import type { MDXInstance } from 'astro'
import { defaultLocale, type DocFrontmatter, type Locale } from './docs'

export type { SystemErrorCode }

export interface SystemErrorFrontmatter extends DocFrontmatter {
  code: SystemErrorCode
  legacy?: boolean
}

export interface SystemErrorPage {
  code: SystemErrorCode
  Content: MDXInstance<SystemErrorFrontmatter>['Content']
  frontmatter: SystemErrorFrontmatter
}

const systemErrorCodes: SystemErrorCode[] = Object.values(SYSTEM).map(code =>
  formatErrorCode(ErrorScope.SYSTEM, code),
)

const isSystemErrorCode = (code: string): code is SystemErrorCode =>
  systemErrorCodes.some(systemErrorCode => systemErrorCode === code)

const englishErrorPageModules = import.meta.glob<
  MDXInstance<SystemErrorFrontmatter>
>('../content/errors/*.mdx', { eager: true })
const chineseErrorPageModules = import.meta.glob<
  MDXInstance<SystemErrorFrontmatter>
>('../content/errors/zh-cn/*.mdx', { eager: true })

const createSystemErrorPages = (
  modules: Record<string, MDXInstance<SystemErrorFrontmatter>>,
  locale: Locale,
  requireComplete = true,
): SystemErrorPage[] => {
  const pages = Object.entries(modules).map(([file, module]) => {
    const code = file
      .split('/')
      .at(-1)
      ?.replace(/\.mdx$/, '')
    if (!code || !isSystemErrorCode(code)) {
      throw new Error(`Unknown system error document: ${file}`)
    }
    if (module.frontmatter.code !== code) {
      throw new Error(`System error document code must match its filename: ${file}`)
    }

    return {
      code,
      Content: module.Content,
      frontmatter: module.frontmatter,
    }
  })
  pages.sort((left, right) => left.code.localeCompare(right.code))
  const documentedCodes = new Set(pages.map(page => page.code))
  const missingCodes = systemErrorCodes.filter(code => !documentedCodes.has(code))
  if (requireComplete && missingCodes.length) {
    throw new Error(
      `Missing ${locale} system error documents: ${missingCodes.join(', ')}`,
    )
  }

  return pages
}

const pagesByLocale: Record<Locale, SystemErrorPage[]> = {
  en: createSystemErrorPages(englishErrorPageModules, 'en', false),
  'zh-cn': createSystemErrorPages(chineseErrorPageModules, 'zh-cn'),
}

export const getSystemErrorPages = (
  locale: Locale = defaultLocale,
): SystemErrorPage[] => {
  return pagesByLocale[locale]
}

export const getSystemErrorPage = (
  code: string,
  locale: Locale = defaultLocale,
): SystemErrorPage | undefined => {
  return getSystemErrorPages(locale).find(page => page.code === code)
}
