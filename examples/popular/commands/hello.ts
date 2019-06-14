import { Command, CommandArgsProvider } from 'func'

@Command({
  name: 'hello',
})
export class Hello {
  constructor(
    private args: CommandArgsProvider,
  ) {
    console.log('hello invoked.')
    console.log(args.inputs, args.option)
  }
}
