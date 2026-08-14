import { HelpContext, HelpFormatter, HelpOption } from 'func/help'

if (
  typeof HelpContext !== 'function' ||
  typeof HelpFormatter !== 'function' ||
  typeof HelpOption !== 'function'
) {
  throw new Error('help subpath is incomplete')
}

console.log('help-entry')
