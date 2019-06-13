import { Command, SubOptions } from '../../../src'

@Command({
  name: 'world',
})
@SubOptions([{
  name: 'name',
  alias: 'n',
}])
export class HelloWorld {
  constructor(
    inputs: string[], option: object, args: any,
  ) {
    console.log('command', inputs, option, args)
  }
}
