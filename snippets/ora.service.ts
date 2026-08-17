import { Context, Injectable } from 'func'
import ora from 'ora'

@Injectable()
export class OraService {
  constructor(private readonly context: Context) {}

  async run<T>(message: string, operation: () => Promise<T>): Promise<T> {
    const progress = ora({
      text: message,
      stream: this.context.io.stderr,
      discardStdin: false,
    }).start()
    const stop = () => progress.stop()
    this.context.signal.addEventListener('abort', stop, { once: true })

    try {
      const result = await operation()
      progress.succeed(message)
      return result
    } catch (error) {
      progress.fail(message)
      throw error
    } finally {
      this.context.signal.removeEventListener('abort', stop)
      progress.stop()
    }
  }
}
