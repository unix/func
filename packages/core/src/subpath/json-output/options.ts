import { createToken } from '../../di/token'

export interface JsonOutputOptions {
  readonly suppressStdout: boolean
}

export const JSON_OUTPUT_OPTIONS = createToken<JsonOutputOptions>(
  'func.json-output.options',
)

export const hasJsonOutputOption = (argv: readonly string[]): boolean => {
  const separator = argv.indexOf('--')
  const options = separator < 0 ? argv : argv.slice(0, separator)
  return options.some(value => value === '--json' || value.startsWith('--json='))
}
