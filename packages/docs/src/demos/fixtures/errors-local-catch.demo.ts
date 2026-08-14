import type { Exception, OnError } from '../../../../core/src'
import { Command, Module, Handler } from '../../../../core/src'

@Command('publish')
class PublishCommand implements OnError {
  onError(exception: Exception) {
    console.error(`Publish failed: ${exception.message}`)
  }

  @Handler()
  async run() {
    throw new Error('Registry is unavailable')
  }
}

@Module({
  commands: [PublishCommand],
})
export class ErrorsLocalCatchModule {}
