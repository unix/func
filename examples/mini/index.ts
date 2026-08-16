import { Command, Handler, Module, Stdout, createApp } from 'func'
import type { Writable } from 'node:stream'

@Command('ping')
class Ping {
  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write('pong\n')
  }
}

@Module({ commands: [Ping] })
class AppModule {}

const app = createApp(AppModule)

void app.bootstrap()
