# func Template Guide

## Project Shape

The template is copied as source files when you create a project with
`npm init func`. It does not include installed packages, downloaded assets, or
build output.

```text
src
|-- app.module.ts
|-- config.ts
|-- commands
|   |-- error.command.ts
|   |-- greet.command.ts
|   |-- index.ts
|   |-- major.command.ts
|   +-- missing.command.ts
|-- services
|   |-- index.ts
|   +-- project.service.ts
+-- index.ts
```

`src/index.ts` runs the application module. `src/app.module.ts` registers
commands and services. `src/config.ts` collects template settings. Each command
class owns its handlers and options.

## Development

Run `npm run dev -- <args>` to execute the TypeScript entry locally.

Examples:

```sh
npm run dev --
npm run dev -- --help
npm run dev -- --version
npm run dev -- --json --mode prod --tag cli
npm run dev -- greet --name func
npm run dev -- greet shout --name func
```

## Commands

- `Major` handles empty invocation plus top-level options such as `--help`,
  `--version`, `--json`, `--mode`, and repeated `--tag` values.
- `Greet` is a named command with an alias, field options, a default handler,
  and a path handler for `greet shout`.
- `Missing` runs when a user enters an unknown command.
- `ErrorHandler` formats runtime-print errors and prevents duplicate default
  printing.

## Options

Prefer field decorators when you want parsed values assigned to the command
instance:

- `@Flag()` for boolean options.
- `@Value()` for string, number, or boolean values.
- `@ArrayValue()` for repeated string values.
- `@Enum()`, `@Required()`, `@DependsOn()`, `@Exclusive()`, and
  `@ValueValidate()` for validation.

`@Args()` injects runtime context into handlers. `@Regs()` injects command
metadata for help output. `@Exception()` injects error context into catch and
error handlers.

## Services

Register services in `@FuncModule({ services })`, then type them in command
constructors. The template includes `ProjectService` as a small example.

## Build

Run `npm run build` to bundle the CLI into the `dist` folder.

## Publish

Publish the package after `dist` has been generated. The template already points
`package.json#bin` at the generated executable.

## Learn More

Read the full docs at [func.witt.im](https://func.witt.im).
