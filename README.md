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
  
## Thanks
Thanks to [Shannon Moeller](https://github.com/shannonmoeller) for donating the pkgname "func" on npm!

## LICENSE
[MIT](./LICENSE)
