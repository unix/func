## func-template

Default project template for creating TypeScript command-line tools with
[func](https://github.com/unix/func).

<br/>

## Features

- Decorator-based command classes.
- Typed flags, values, repeated values, and validators.
- Top-level `--help` and `--version` handlers.
- Command aliases and path handlers.
- Missing-command and runtime-print error handlers.
- Service injection through `@FuncModule`.
- A source-only template that builds into a small CLI output.

<br/>

## Get Started

Install dependencies after the project has been created:

```sh
npm install
```

Run the CLI from the TypeScript source:

```sh
npm run dev --
npm run dev -- --help
npm run dev -- greet --name func
npm run dev -- greet shout --name func
```

Build the distributable CLI:

```sh
npm run build
```

`funcgo build` writes the bundled output to `dist` and creates `dist/bin.js`.
The template itself stays source-only; generated files are not part of the
default template copied by `npm init func`.

For the file-by-file guide, see [template-readme.md](./template-readme.md).
