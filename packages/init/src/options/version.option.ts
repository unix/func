import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { Handler, OptionCommand, Stdout } from 'func'
import type { Writable } from 'node:stream'

interface PackageInfo {
  readonly version: string
}

const isPackageInfo = (value: unknown): value is PackageInfo =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string'

const packageValue: unknown = require('../../package.json')
if (!isPackageInfo(packageValue)) {
  throw new ScaffoldException(SCAFFOLD.INVALID_PACKAGE_METADATA, {
    details: { package: packageValue },
    message: 'create-func package metadata is invalid.',
  })
}
const pkg = packageValue

@OptionCommand({
  alias: 'v',
  description: 'output the version number',
  name: 'version',
})
export class VersionOption {
  @Handler()
  run(@Stdout() stdout: Writable): void {
    stdout.write(`${pkg.version}\n`)
  }
}
