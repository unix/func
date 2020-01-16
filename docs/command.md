# Commands

## Create Command

In `func`, creating a command is very simple, you just need to add `Command` annotations for any class:

```ts
@Command({
  name: 'hello',
})
export class MyFirstCommand {
  constructor() { console.log('ok') }
}
```

Assuming the name of your command line tool is "hello-func", you only need to run `hello-func hello` and the terminal will display `ok`.
Everything is achieved in this way.

<img src="hello-func-3.png" width="350">

## Create Option

We know that there are usually some top-level options for command-line tools too.
Taking your "tools" as an example, you may want its functions, such as `<command> --version` and so on available for support.

Here, we can use the `Option` decorator to realize very elegantly:

```ts
import { Option } from 'func'

@Option({
  name: 'version',
  alias: 'v',
})
export class Version {
  constructor() { console.log('1.0.0') }
}
```

After adding some information to your class `Version`, it will be triggered when `--version` and `-v`.

<img src="hello-func-4.png" width="350">

This is very simple, `-v` is its alias.

The `func` allows you to create aliases for any command.
if it is an alias for the `Option` command, only a `-` is required to use it, which is also standard.

## Create Sub-options

Inside the func, a decorator `SubOptions` is also ready for you to implement this type of command `<command> --<option>`:

```ts
@Command({
  name: 'apple',
})
@SubOptions([{ name: 'help', alias: 'h' }])
export class MyFirstSubOption {

  constructor(
    private arg: CommandArgsProvider,
  ) {
    if (arg.option.help) {
      console.log('HELP MESSAGE: The apple is red')
    }
    console.log('ok')
  }
  
}
```
<br/>
<img src="hello-func-5.png" width="380">

Refer to the chapter of [Parameters](/params.md) for how to get the values of options.

## Create Main Command

The main command refers to that scenario that only the name of your command line is run without carrying any parameters:

```ts
import { CommandMajor } from 'func'

@CommandMajor()
export class Main {
}
```

If your tool of command lines is still called `hello-func`, then just running `hello-func` will trigger the main command.

## Get Missing Command

In a few cases, users may enter parameters or commands incorrectly.
You need to guide the user with some tips of information kindly given. `CommandMissing` is used to solve this problem.
Without any `Command` or `Option` found, being unable to be found will be triggered:

```ts
import { CommandMissing } from 'func'

@CommandMissing()
export class Missing {
  constructor() { console.log('not found any commands!') }
}
```
