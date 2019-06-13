## FUNC

More popular and simple way to build command-line tools.

## Usage
work in progress.


### Easy Command
Create a command with more semantics:

  ```ts
  @Command({
    name: 'init',
  })
  export class Init {
    constructor(
    ) {
      console.log('init trigger')
    }
  }
  ```

## LICENSE
[MIT](./LICENSE)
