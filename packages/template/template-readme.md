# Template Guide

## How to work

Framework `func` analyzes your classes, distinguishes commands from options, and runs the matching item.
The `funcgo` service handles local development and bundling so the project can focus on command behavior.

Want to learn more? Read the [`func` guide](https://github.com/unix/func#guide).

## Development

Run `pnpm dev -- <args>` to execute the TypeScript entry locally.

Examples:

```sh
pnpm dev --
pnpm dev -- hello
pnpm dev -- --version
```

## Bundle

Run `pnpm build` to bundle the CLI into the `dist` folder.

## Release CLI

Publish the package after the `dist` folder has been generated.
