import {
  Catch,
  Command,
  DependsOn,
  Exception,
  Exclusive,
  Flag,
  Handler,
  Required,
  Value,
  ValueValidate,
} from 'func'
import type { FuncException } from 'func'

@Command({ name: 'deploy' })
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

  @Catch()
  handleError(@Exception() exception: FuncException) {
    console.error(`local:${exception.code}:${exception.message}`)
    exception.preventDefaultPrint()
  }
}
