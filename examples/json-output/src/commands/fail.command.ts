import { Command, Exception, Handler } from 'func'

@Command({
  path: 'fail',
  description: 'show how errors are rendered',
})
export class FailCommand {
  @Handler()
  run() {
    throw new Exception('DEMO_FAILURE', {
      message: 'The demo command failed.',
    })
  }
}
