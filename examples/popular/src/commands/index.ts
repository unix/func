import { ErrorHandler } from './error.command'
import { Greet } from './greet.command'
import { Major } from './major.command'
import { Missing } from './missing.command'

export const commands = [Major, Greet, Missing, ErrorHandler]
