---
editLink: https://github.com/WittBulter/func/blob/master/docs/zh/params.md
---

# 参数获取

## Command 的参数

在你构建命令的类中添加一个参数并为它标记类型，这个参数就会被自动注入为命令的参数:

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

当你运行 `tools test --help` 时，参数就如上文所示，这有点意思，不是吗？
你可以使用任何你喜欢的参数名，只需要保证它的类型是 `CommandArgsProvider` 即可。

`arg.native` 是命令行解析时的原始数据，如果你在写一些非标准的命令行参数，这可能会对你有帮助。


## Option 参数

与 `Command` 类似，但 `OptionArgsProvider` 的参数只有一个基础值。你可以在 `Option` 中约定参数类型，以获取更多的信息:

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

## 所有注册信息

如果你在编写一个帮助命令或是例举用户可能的输入，可能需要用到当前注册的所有信息，`RegisterProvider` 参数可以帮助你，它携带了
当前命令行项目中所有的注册信息:

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

