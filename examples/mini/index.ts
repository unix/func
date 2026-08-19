import { createParser } from 'func/parser'

const parser = createParser({
  commands: {
    ping: {},
  },
})

type Write = (message: string) => void

export const main = (
  argv: readonly string[] = process.argv.slice(2),
  write: Write = console.log,
): void => {
  const invocation = parser.parse(argv)
  if (invocation.command === 'ping') write('pong')
}

if (require.main === module) main()
