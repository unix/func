import { AsyncCommand } from './async.command.js'
import { DeployCommand } from './deploy.command.js'
import { ErrorCommand } from './error.command.js'
import { GreetCommand } from './greet.command.js'
import { MajorCommand } from './major.command.js'
import { MissingCommand } from './missing.command.js'

export const commands = [
  MajorCommand,
  AsyncCommand,
  GreetCommand,
  DeployCommand,
  MissingCommand,
  ErrorCommand,
]
