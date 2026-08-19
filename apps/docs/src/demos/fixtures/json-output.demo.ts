import { Command, Handler, Module, Stdout } from '../../../../../packages/core/src'
import {
  JsonOutput,
  JsonOutputModule,
} from '../../../../../packages/core/src/subpath/json-output'
import type { Writable } from '../runtime/terminal-stream'

@Command('status')
class StatusCommand {
  constructor(private readonly output: JsonOutput) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write('Checking service status...\n')
    this.output.json({ status: 'ready' })
  }
}

@Module({
  commands: [StatusCommand],
  imports: [JsonOutputModule],
})
export class JsonOutputDemoModule {}
