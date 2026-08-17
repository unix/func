import { createParser } from 'func/parser'

const parser = createParser({
  commands: {
    ping: {},
  },
})

const invocation = parser.parse(process.argv.slice(2))
if (invocation.command === 'ping') console.log('pong')
