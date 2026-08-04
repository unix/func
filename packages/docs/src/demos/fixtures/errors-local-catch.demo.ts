import {
  Catch,
  Command,
  Exception,
  FuncException,
  FuncModule,
  Handler,
} from '../../../../core/src'

@Command({ name: 'publish' })
class PublishCommand {
  @Catch()
  onError(@Exception() exception: FuncException) {
    console.error(`Publish failed: ${exception.message}`)
  }

  @Handler()
  async run() {
    throw new Error('Registry is unavailable')
  }
}

@FuncModule({
  commands: [PublishCommand],
})
export class ErrorsLocalCatchModule {}
