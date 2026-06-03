import { Command, Handler } from 'func'

@Command({
  name: 'test',
})
export class Test {
  @Handler()
  run() {
    console.log('test ok!')
  }
}
