import { Command, Module, Handler, createApp } from 'func'

@Command('ping')
class Ping {
  @Handler()
  run() {
    console.log('pong')
  }
}

@Module({ commands: [Ping] })
class AppModule {}

const app = createApp(AppModule)

void app.bootstrap()
