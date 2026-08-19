import { Injectable } from 'func'

@Injectable()
export class GreetService {
  greet(name: string, upper: boolean) {
    const message = `Hello, ${name}!`
    return upper ? message.toUpperCase() : message
  }

  shout(name: string) {
    return `HELLO, ${name.toUpperCase()}!`
  }
}
