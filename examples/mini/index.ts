import { Command, Module, Handler, run } from 'func'

@Command('ping')
class Ping {
  @Handler()
  run() {
    console.log('pong')
  }
}

@Module({ commands: [Ping] })
class AppModule {}

run(AppModule)
