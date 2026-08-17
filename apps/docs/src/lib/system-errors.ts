import {
  ErrorScope,
  SYSTEM,
  formatErrorCode,
  type SystemErrorCode,
} from '@func/contracts/core-errors'
import {
  SCAFFOLD,
  formatScaffoldErrorCode,
  type ScaffoldErrorCode,
} from '@func/contracts/scaffold-errors'
import type { MDXInstance } from 'astro'
import { defaultLocale, type DocFrontmatter, type Locale } from './docs'

export type DocumentedErrorCode = ScaffoldErrorCode | SystemErrorCode
export type ErrorFamily = 'scaffold' | 'system'

export type { ScaffoldErrorCode, SystemErrorCode }

export interface SystemErrorFrontmatter extends DocFrontmatter {
  code: DocumentedErrorCode
  legacy?: boolean
}

export interface SystemErrorPage {
  code: DocumentedErrorCode
  Content: MDXInstance<SystemErrorFrontmatter>['Content']
  family: ErrorFamily
  frontmatter: SystemErrorFrontmatter
}

const systemErrorCodes: SystemErrorCode[] = Object.values(SYSTEM).map(code =>
  formatErrorCode(ErrorScope.SYSTEM, code),
)
const scaffoldErrorCodes: ScaffoldErrorCode[] = Object.values(SCAFFOLD).map(code =>
  formatScaffoldErrorCode(code),
)
const documentedErrorCodes: DocumentedErrorCode[] = [
  ...systemErrorCodes,
  ...scaffoldErrorCodes,
]

const isDocumentedErrorCode = (code: string): code is DocumentedErrorCode =>
  documentedErrorCodes.some(errorCode => errorCode === code)

const errorFamily = (code: DocumentedErrorCode): ErrorFamily =>
  code.startsWith('F_SCAFFOLD_') ? 'scaffold' : 'system'

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
    if (!code || !isDocumentedErrorCode(code)) {
      throw new Error(`Unknown error document: ${file}`)
    }
    if (module.frontmatter.code !== code) {
      throw new Error(`Error document code must match its filename: ${file}`)
    }

    return {
      code,
      Content: module.Content,
      family: errorFamily(code),
      frontmatter: module.frontmatter,
    }
  })
  pages.sort((left, right) => left.code.localeCompare(right.code))
  const documentedCodes = new Set(pages.map(page => page.code))
  const missingCodes = documentedErrorCodes.filter(
    code => !documentedCodes.has(code),
  )
  if (requireComplete && missingCodes.length) {
    throw new Error(`Missing ${locale} error documents: ${missingCodes.join(', ')}`)
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
