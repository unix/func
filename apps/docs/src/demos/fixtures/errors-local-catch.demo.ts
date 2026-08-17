import type { Exception, ExceptionFilter } from '../../../../../packages/core/src'
import {
  Catch,
  Command,
  Handler,
  Module,
  UseFilters,
} from '../../../../../packages/core/src'

@Catch()
class PublishFilter implements ExceptionFilter {
  catch(exception: Exception) {
    console.error(`Publish failed: ${exception.message}`)
  }
}

@UseFilters(PublishFilter)
@Command('publish')
class PublishCommand {
  @Handler()
  async run() {
    throw new Error('Registry is unavailable')
  }
}

@Module({
  commands: [PublishCommand],
})
export class ErrorsLocalCatchModule {}
