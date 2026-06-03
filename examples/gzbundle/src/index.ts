import * as commands from './commands'
import { FuncModule, run } from 'func'

const modules = Object.assign({}, commands)
const params = Object.values(modules) as Array<new (...args: any[]) => any>

@FuncModule({
  commands: params,
})
class AppModule {}

run(AppModule)
