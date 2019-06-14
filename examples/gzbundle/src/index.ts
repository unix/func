import * as commands from './commands'
import * as options from './options'
import { Container } from 'func'

const modules = Object.assign({}, commands, options)
const params = Object.keys(modules).map(key => modules[key])
new Container(params)
