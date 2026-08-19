import { isException } from '@func/contracts/exception'
import { ScaffoldErrorScope } from '@func/contracts/scaffold-errors'
import { Module, Stderr } from 'func'
import type { Exception, OnError } from 'func'
import { HelpOption } from 'func/help'
import type { Writable } from 'node:stream'
import { CreateModule } from './commands/create/create.module'
import { VersionOption } from './options/version.option'

@Module({
  imports: [CreateModule],
  options: [HelpOption, VersionOption],
})
export class AppModule implements OnError {
  constructor(@Stderr() private readonly stderr: Writable) {}

  onError(exception: Exception): void {
    this.stderr.write(`${formatCliError(exception)}\n`)
  }
}

const formatCliError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error ? error.cause : undefined
  const code = scaffoldErrorCode(error) ?? scaffoldErrorCode(cause)
  if (!code) return message
  return `${message}\n\nLearn how to fix this error: https://f.witt.im/${code.slice(2)}`
}

const scaffoldErrorCode = (error: unknown): string | undefined => {
  if (!isException(error) || error.scope !== ScaffoldErrorScope) return undefined
  return error.code
}
