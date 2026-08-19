import type { Exception, OnError } from '../../../../../packages/core/src'
import { Command, Handler, Module } from '../../../../../packages/core/src'

@Command('publish')
class PublishCommand implements OnError {
  @Handler()
  async run() {
    throw new Error('Registry is unavailable')
  }

  onError(exception: Exception) {
    console.error(`Publish failed: ${exception.message}`)
  }
}

@Module({
  commands: [PublishCommand],
})
export class ErrorsLocalCatchModule {}
