import { Option, OptionArgsProvider, RegisterProvider } from '../../../src'

@Option({
  name: 'help',
  alias: 'h',
  type: Boolean,
})
export class Help {
  constructor(
    args: OptionArgsProvider,
    register: RegisterProvider,
  ) {
    // inputs
    console.log(123, register.commands, register.options)
  }
}
