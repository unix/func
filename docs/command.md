---
editLink: https://github.com/WittBulter/func/blob/master/docs/command.md
---

# Commands

## Create the Command

In `func`, creating a command is very simple, you just need to add `Command` annotations for any class:

```ts
@Command({
  name: 'test',
})
export class Test {
  constructor() { console.log('ok') }
}
```

Assuming the name of your command line tool is "tools", you only need to run `tools test` and the terminal will display `ok`. 
Everything is achieved in this way.

The class of this `Test` is no different from that you usually write, which is just to be used automatically when the command is run. 
Everything is so familiar. You can write any logic you like in the class.

## Create the Option

We know that there are usually some top-level options for command-line tools too. 
Taking your "tools" as an example, you may want its functions, such as `tools --version` / `tools --help` and so on available for support.

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
This is very simple, `-v` is its alias. The func allows you to create aliases for any command.
if it is an alias for the `Option` command, only a `-` is required to use it, which is also standard.

## Create the Sub-options

You may be dep into thinking after completing the `tools test` command. 
If I need to add a subcommand based on this command, how I will do. I will do it like `tools test --help`.
In fact, inside the func, a decorator `SubOptions` is also ready for you:

```ts
@Command({
  name: 'test',
})
@SubOptions([{ name: 'help', alias: 'h' }])
export class Test {
  constructor() { console.log('ok') }
}
```

This allows you to use the option that `--help` is added based on the command `test`. 
Refer to the chapter of [Obtaining Parameters] (/params.md) for how to obtain the values of options.

## Create the Main Command

The main command refers to that scenario that only the name of your command line is run without carrying any parameters:

```ts
import { CommandMajor } from 'func'

@CommandMajor()
export class Main {
}
```

If your tool of command lines is still called `tools`, then just running `tools` will trigger the main command.

## Create the NotFound Command

In a few cases, users may enter parameters or commands incorrectly. 
You need to guide the user with some tips of information kindly given. `CommandNotFound` is used to solve this problem.
Without any `Command` or `Option` found, being unable to be found will be triggered:

```ts 
import { CommandNotFound } from 'func'

@CommandNotFound()
export class NotFound {
  constructor() { console.log('not found any commands!') }
}
```
