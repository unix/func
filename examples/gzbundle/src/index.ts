import * as commands from './commands'
import * as options from './options'
import { Container } from 'func'

const modules = Object.assign({}, commands, options)
const params = Object.values(modules) as Array<new (...args: any[]) => any>
new Container(params)
