import { siteName, siteUrl, type Locale } from './docs'

interface StructuredDataOptions {
  canonicalUrl: string
  description: string
  lastModified?: string
  locale: Locale
  title: string
}

const languageTags: Record<Locale, string> = {
  en: 'en',
  'zh-cn': 'zh-CN',
}

export const createStructuredData = ({
  canonicalUrl,
  description,
  lastModified,
  locale,
  title,
}: StructuredDataOptions) => {
  const websiteUrl = new URL('/', siteUrl).toString()
  const websiteId = `${websiteUrl}#website`
  const organizationId = `${websiteUrl}#organization`
  const pageId = `${canonicalUrl}#webpage`
  const imageUrl = new URL('/og.png', siteUrl).toString()
  const logoUrl = new URL('/logo-dark@2x.png', siteUrl).toString()

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: siteName,
        url: websiteUrl,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: websiteUrl,
        name: `${siteName} Documentation`,
        inLanguage: Object.values(languageTags),
        publisher: {
          '@id': organizationId,
        },
      },
      {
        '@type': lastModified ? 'TechArticle' : 'WebPage',
        '@id': pageId,
        url: canonicalUrl,
        name: title,
        description,
        image: imageUrl,
        inLanguage: languageTags[locale],
        isPartOf: {
          '@id': websiteId,
        },
        ...(lastModified
          ? {
              headline: title,
              dateModified: lastModified,
              mainEntityOfPage: {
                '@id': pageId,
              },
              author: {
                '@type': 'Person',
                name: 'Witt',
              },
              publisher: {
                '@id': organizationId,
              },
            }
          : {}),
      },
    ],
  }
}

export const serializeStructuredData = (data: unknown) => {
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}
