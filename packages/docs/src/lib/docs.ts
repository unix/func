export type DocPage = '/' | 'guide' | 'commands' | 'parameters' | 'apis'

export const siteName = 'FUNC'
export const siteSlogan = 'Small typed CLI framework'
export const siteTitle = `${siteName} - ${siteSlogan}`

export const navItems: Array<{ href: string; id: DocPage; label: string }> = [
  { id: '/', label: '/', href: '/' },
  { id: 'guide', label: 'Guide', href: '/guide' },
  { id: 'commands', label: 'Commands', href: '/commands' },
  { id: 'parameters', label: 'Parameters', href: '/parameters' },
  { id: 'apis', label: 'APIs', href: '/apis' },
]
