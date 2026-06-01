import { Container } from 'func'
import { commands } from './commands'
import { options } from './options'

new Container([...commands, ...options])
