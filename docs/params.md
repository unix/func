# Obtaining Parameters

## Parameters of Command

Add a parameter to the class in which you build the command and mark the class for the parameter, 
which is automatically injected as the parameter of the command:

```ts
import { Command, CommandArgsProvider } from 'func'

@Command({ name: 'test' })
@SubOptions([{ name: 'help' }])
export class Test {

  constructor(
    private arg: CommandArgsProvider,
  ) {
    console.log(arg.inputs)     // ['tools', 'test']
    console.log(arg.option)     // { help: true }
    console.log(arg.native)     // original parse infos
  }
  
}

```

When you run `tools test --help`, the parameters are shown as above, which is a bit interesting, isn't it?
You can use any parameter name you like, just ensuring its class is `CommandArgsProvider`.

The `arg.native` is the raw data for command line parsing, which may be helpful if you are writing the parameters of some non-standard command lines.

## Parameters of Option

Similar to  the `Command`, but only one base value is available for the parameter of `OptionArgsProvider`. 
You can specify the class of a parameter in `Option` to obtain more information:

```ts
import { Option, OptionArgsProvider } from 'func'

@Option({ name: 'name', type: String })
export class Name {
  constructor(
    private arg: OptionArgsProvider,
  ) {
    console.log(arg.name)
  }
}
```

## All Registered Information

If you are writing a help command or naming a user's possible input, you may need to use all the information registered at present. 
The parameter of `RegisterProvider` can help you due to carry all information registered in the item of current command lines:

```ts
import { Option, RegisterProvider } from 'func'

@Option({ name: 'help' })
export class MyHelp {
  constructor(
    private arg: RegisterProvider,
  ) {
    console.log(arg.commands)         // all commands
    console.log(arg.options)         // all options
  }
}
```
