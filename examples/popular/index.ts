import { commands } from './commands'
import { options } from './options'
import { Container } from 'func'

new Container([...commands, ...options])
