export type DocPage =
  | '/'
  | 'guide'
  | 'concepts'
  | 'commands'
  | 'parameters'
  | 'tooling'
  | 'errors'
  | 'apis'

export const siteName = 'FUNC'
export const siteSlogan = 'Tiny typed CLI framework'
export const siteTitle = `${siteName} - ${siteSlogan}`

export const navItems: Array<{ href: string; id: DocPage; label: string }> = [
  { id: '/', label: '/', href: '/' },
  { id: 'guide', label: 'Guide', href: '/guide' },
  { id: 'concepts', label: 'Concepts', href: '/concepts' },
  { id: 'commands', label: 'Commands', href: '/commands' },
  { id: 'parameters', label: 'Parameters', href: '/parameters' },
  { id: 'tooling', label: 'Tooling', href: '/tooling' },
  { id: 'errors', label: 'Errors', href: '/errors' },
  { id: 'apis', label: 'APIs', href: '/apis' },
]
