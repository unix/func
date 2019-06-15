<p width="640" height="320" align="center">
<img src="./demo.png" width="640" height="320"/>
</p>
<br/>

## FUNC

[![CircleCI](https://circleci.com/gh/WittBulter/func.svg?style=svg)](https://circleci.com/gh/WittBulter/func) [![Build Status](https://travis-ci.org/WittBulter/func.svg?branch=master)](https://travis-ci.org/WittBulter/func)

More popular and simple way to build command-line tools.

<br/>

## Feature

  - Small size package. (full command-line project == [7kb](https://github.com/WittBulter/func/blob/master/examples/gzbundle/archived.tar.gz))
  
  - Elegant command support and params support.
  
  - Very few dependencies, run faster.
  
  - Excellent module design, not burden of thinking.
  
  - Full template support, developable at one command.


<br/>

## Usage
`func` provide some annotations for create command line tools, it makes your code more semantic than ever, and easy to maintain.

### Quick Start (**Recommended**, npm version > 6.1.0)

  Jsut run `npm init func` to create project.
  
  1. `npm init func`: create project
  
  2. `npm i`: install deps.
  
  3. `npm start`: setup link and development ready.
  
  It's all.
  
<br/>

### Install
  You can choose to configure the project manually, if you are an experienced developer.
  

  1. Install: `npm i func`.
  
  2. Your `tsconfig.json` should contain these items:
  
    ```
    "compilerOptions": {
      ...
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      ...
    }
    ```
### Quick start:
  
  ```ts
  import { Container, Command } from 'func'

  @Command({
    name: 'test',
  })
  export class Test {
    constructor() { console.log('ok') }
  }
  
  new Container([Init])
  ```

<br/>

### Guide

#### Container
  Entry to all modules, there must be one.
  
  ```ts
  // app.ts
  import { Container, Command } from 'func'
  import { Create } from './create'
  import { Build } from './build'
  
  new Container([Create, Build])
  ```
  
#### Command (`<NAME> command`)
  Implement a command, `class` are triggered when a command is called.
  
  ```ts
  // ./create.ts
  // called by `<NAME> create` 
  import { Command } from 'func'
  
  @Command({
    name: 'create',
  })
  export class Create {
    constructor() { console.log('create trigger') }
  }
  ```
  
#### Option (`<NAME> --option`)
  Implement a global option.
  
  ```ts
  // ./option.ts
  // called by `<NAME> --help` 
  import { Option } from 'func'
  
  @Option({
    name: 'help',
  })
  export class Help {
  }
  ```
  
#### SubOptions (`<NAME> command --suboption`)
  Add options based on a command.
  
  ```ts
  // ./create.ts
  // called by `<NAME> create` or `<NAME> create --force` 
  import { Command, SubOptions } from 'func'
  
  @Command({
    name: 'create',
  })
  @SubOptions([{ name: 'force' }])
  export class Create {
  }
  ```
  
#### Major (`<NAME>`)
  Trigger without Command and Option.
  
  ```ts
  // ./main.ts
  // called by `<NAME>`
  import { CommandMajor } from 'func'
  
  @CommandMajor()
  export class Main {
  }
  ```

#### NotFound (`<NAME> <ANY>`)
  Trigger when no commands are found
  
  ```ts
  // ./not-found.ts
  import { CommandNotFound } from 'func'
  
  @CommandNotFound()
  export class NotFound {
    constructor() { console.log('not found any commands!') }
  }
  ```

#### Command Arguments
  Provide arguments in commands
  
  ```ts
  // called by `<NAME> create --force` 
  import { Command, CommandArgsProvider } from 'func'
  
  @Command({ name: 'create' })
  @SubOptions([{ name: 'force' }])
  export class Create {
    constructor(
      private arg: CommandArgsProvider,
    ) {
      console.log(arg.inputs)     // ['name', 'create']
      console.log(arg.option)     // { force: true }
      console.log(arg.native)     // original parse infos
    }
  }
  ```


#### Option Arguments
  Provide arguments in options
  
  ```ts
  // called by `<NAME> --project my_project` 
  import { Option, OptionArgsProvider } from 'func'
  
  @Option({ name: 'project', type: String })
  export class Project {
    constructor(
      private arg: OptionArgsProvider,
    ) {
      console.log(arg.project)      // 'my_project'
    }
  }
  ```
 
#### Register Arguments
  Provide all registers in any class.
  
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

<br/>

## Decorators Reference
### Commands:

| Signature | Param structure | Description |
|----|----|----|
| `@Command(params: CommandParams)` | `CommandParams = { name: string, description?: string, alias?: string }` | create a command |
| `@Option(params: OptionParams)` | `OptionParams = { name: string, type?: OptionType, description?: string, alias?: string }` | create an option |
| `@SubOptions(params: Array<OptionParams>)` | ditto | create a suboption, usually used after `Command` |
| `@CommandNotFound()` | - | create a method to capture undeclared commands |
| `@CommandMajor()` | - | major command |

### Arguments Type

| Signature | Description |
|----|----|
| `CommandArgsProvider` | provide infos about the current command |
| `OptionArgsProvider` | provide infos about the current option |
| `RegisterProvider` | provide all registered metadata |

<br/>

### Examples

  - [mini](https://github.com/WittBulter/func/tree/master/examples/mini)
  - [popular](https://github.com/WittBulter/func/tree/master/examples/popular)
  - [recommend](https://github.com/WittBulter/func/tree/master/examples/recommend)

<br/>

## Thanks
Thanks to [Shannon Moeller](https://github.com/shannonmoeller) for donating the pkgname "func" on npm!

<br/>

## LICENSE
[MIT](./LICENSE)
