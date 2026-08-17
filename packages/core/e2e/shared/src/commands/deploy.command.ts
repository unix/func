import {
  Catch,
  Command,
  DependsOn,
  Exclusive,
  Flag,
  Handler,
  Required,
  Value,
  ValueValidate,
  UseFilters,
} from 'func'
import type { Exception, ExceptionFilter } from 'func'

@Catch()
class DeployFilter implements ExceptionFilter {
  catch(exception: Exception) {
    console.error(`local:${exception.code}:${exception.message}`)
  }
}

@UseFilters(DeployFilter)
@Command('deploy')
export class DeployCommand {
  @Required()
  @ValueValidate(value => typeof value === 'string' && value.length >= 3)
  @Value()
  target?: string

  @Value()
  token?: string

  @DependsOn(['token'])
  @Value()
  registry?: string

  @Exclusive(['json'])
  @Flag()
  table = false

  @Flag()
  json = false

  @Handler()
  run() {
    console.log(
      JSON.stringify({
        json: this.json,
        registry: this.registry,
        table: this.table,
        target: this.target,
      }),
    )
  }
}
