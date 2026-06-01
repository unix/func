import { Command } from 'func'

@Command({
  name: 'hello',
  description: 'print hello text',
})
export class Hello {
  constructor() {
    console.log('hello command trigger!')
  }
}
