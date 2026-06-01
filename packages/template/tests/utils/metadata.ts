import path from 'path'
import pkg from '../../package.json'

const firstBin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[Object.keys(pkg.bin)[0]]

if (!firstBin) {
  throw new Error(
    'Not found item "bin" in "package.json", maybe you need run "pnpm setup" or "pnpm build".',
  )
}

export const bin = path.resolve(__dirname, '../..', firstBin)
