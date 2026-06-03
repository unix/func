import {
  Command,
  Handler,
  run,
} from 'func'

@Command({ name: 'ping' })
class Ping {
  @Handler()
  run() {
    console.log('pong')
  }
}

run(Ping)
