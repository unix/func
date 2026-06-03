import { Args, Command, FuncArgs, Handler } from 'func'

@Command({
  name: 'hello',
})
export class Hello {
  @Handler()
  run(@Args() args: FuncArgs) {
    console.log('hello invoked.')
    console.log(args.inputs, args.option)
  }
}
