## funcgo

Standard tooling for [`func`](https://github.com/unix/func) development.

<br/>

### Usage

- Install with `pnpm add funcgo -D`

- setup project suggestions: `funcgo setup`

- apply setup suggestions: `funcgo setup --fix`

- development: `funcgo dev -- <args>`

- build cli project with Rolldown: `funcgo build`

- build cli project with the ncc compatibility bundler: `funcgo build-ncc`

- continuously build when TypeScript files change: `funcgo build --watch`

- continuously build using custom paths or globs:
  `funcgo build --watch --watch-path 'src/**/*.ts' --watch-path config.json`

<br/>

### Params

- `funcgo setup`: [--fix]

- `funcgo dev`: [-f, 'entry file'] [--, 'command args']

- `funcgo build`: [-f, 'entry file'] [-o, 'output dir'] [-e, 'external package']
  [--watch] [--watch-path, 'file, directory, or positive glob']

- `funcgo build-ncc`: supports the same parameters as `funcgo build`

<br/>

### LICENSE

[MIT](./LICENSE)
