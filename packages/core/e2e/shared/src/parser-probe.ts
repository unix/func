import { ParserError, createParser } from 'func/parser'

const parser = createParser({
  commands: {
    build: {
      options: {
        watch: { alias: 'w', type: Boolean },
      },
    },
  },
})
const result = parser.parse(['build', '-w'])

if (
  result.command !== 'build' ||
  result.options.watch !== true ||
  typeof ParserError !== 'function'
) {
  throw new Error('parser subpath is incomplete')
}

console.log('parser-entry')
