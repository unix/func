import {
  Command,
  DependsOn,
  Exclusive,
  Flag,
  Handler,
  Required,
  Value,
  ValueValidate,
} from 'func'
import type { Exception, OnError } from 'func'

@Command('deploy')
export class DeployCommand implements OnError {
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

  onError(exception: Exception) {
    console.error(`local:${exception.code}:${exception.message}`)
  }
}
