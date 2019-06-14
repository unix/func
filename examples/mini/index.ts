import { Container, Command } from 'func'

@Command({ name: 'create' })
export class Create {
  constructor() {
    console.log('ok')
  }
}

new Container([Create])
