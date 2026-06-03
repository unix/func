import { Command, FuncModule, Handler, run } from 'func'

@Command({ name: 'create' })
export class Create {
  @Handler()
  run() {
    console.log('ok')
  }
}

@FuncModule({
  commands: [Create],
})
class AppModule {}

run(AppModule)
