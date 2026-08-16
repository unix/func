import path from 'node:path'
import { fileURLToPath } from 'node:url'

const templatesRoot = fileURLToPath(new URL('./templates/', import.meta.url))

const isInsideTemplates = () => {
  const relativePath = path.relative(templatesRoot, process.cwd())
  if (path.isAbsolute(relativePath)) return false
  if (relativePath === '..') return false
  return !relativePath.startsWith(`..${path.sep}`)
}

const assertOutsideTemplates = () => {
  if (!isInsideTemplates()) return

  throw new Error(
    'pnpm dependency operations are disabled inside the repository template source. Run pnpm from the workspace root instead.',
  )
}

assertOutsideTemplates()

export const hooks = {}
