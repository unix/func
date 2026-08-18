## funcgo

Standard tooling for [`func`](https://github.com/unix/func) development.

<br/>

### Usage

- Install with `pnpm add funcgo -D`

- setup project suggestions: `funcgo setup`

- apply setup suggestions: `funcgo setup --fix`

- development: `funcgo dev -- <args>`

- build cli project with Rolldown: `funcgo build`

- continuously build when TypeScript files change: `funcgo build --watch`

- continuously build using custom paths or globs:
  `funcgo build --watch --watch-path 'src/**/*.ts' --watch-path config.json`

<br/>

### Params

- `funcgo setup`: [--fix]

- `funcgo dev`: [-f, 'entry file'] [--, 'command args']

- `funcgo build`: [-f, 'entry file'] [-o, 'output dir'] [-e, 'external package']
  [--watch] [--watch-path, 'file, directory, or positive glob']

<br/>

### Application precompilation

`funcgo build` precompiles statically analyzable `func` application graphs by
default and falls back to runtime graph compilation for dynamic definitions.
Configure the behavior through `package.json`:

```json
{
  "func": {
    "precompile": "auto"
  }
}
```

- `"auto"` (default): precompile when safe, otherwise fall back.
- `"required"`: fail the build unless the complete graph is precompiled.
- `false`: disable application graph precompilation.

<br/>

### LICENSE

[MIT](./LICENSE)
