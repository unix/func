import { Injectable } from 'func'

@Injectable()
export class OutputService {
  line(message: string) {
    return `${message}\n`
  }
}
