export type DocPage =
  | '/'
  | 'guide'
  | 'concepts'
  | 'commands'
  | 'options'
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
  { id: 'concepts', label: 'Core Concepts', href: '/concepts' },
  { id: 'options', label: 'Field Options', href: '/options' },
  { id: 'parameters', label: 'Parameters', href: '/parameters' },
  { id: 'errors', label: 'Errors', href: '/errors' },
  { id: 'tooling', label: 'Tooling', href: '/tooling' },
  { id: 'apis', label: 'API Reference', href: '/apis' },
]
