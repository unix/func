import { Option, OptionArgsProvider } from 'func'

@Option({
  name: 'help',
  alias: 'h',
})
export class Help {
  constructor(arg: OptionArgsProvider) {
    console.log(arg.value)
  }
}
