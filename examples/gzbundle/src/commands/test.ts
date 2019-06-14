import { Command } from 'func'

@Command({
  name: 'test',
})
export class Test {
  constructor() {
    console.log('test ok!')
  }
}
