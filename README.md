<p width="640" height="320" align="center">
<img src="./demo.png" width="640" height="320"/>
</p>
<br/>

## FUNC

A tiny decorator-based CLI framework for TypeScript.

`func` helps you build command-line tools with class decorators, typed runtime
context injection, a small production footprint, and a template workflow that is ready
to use from the first command.

<br/>

## Features

- Tiny production bundles by default. See a reference output
  [here](https://github.com/unix/func/blob/main/examples/popular/archived.tar.gz).

- Write CLIs like real TypeScript applications, with decorators, classes, and
  dependency-friendly modules instead of scattered command wiring.

- Move faster from idea to shipped command: `funcgo` handles project setup,
  local TypeScript execution, and production bundling.

- Keep command code focused on the work itself while `func` takes care of names,
  paths, flags, values, validation, and missing-command behavior.

- Grow from a small helper into a multi-command tool without rewriting your
  structure, thanks to modules, reusable services, and typed context injection.

- Give users clearer failures by keeping validation and error handling close to
  the command logic that owns them.

<br/>

## Quick Start

We recommend starting every new project from the official template:

```sh
npm init func
```

The generated project already includes the standard `func` setup, development
script, build script, and package configuration.

If you need to build without the template, browse the
[examples](./examples) folder for small project structures and usage patterns.

<br/>

## Documentation

- [func.witt.im](https://func.witt.im)
<br/>

## Thanks

Thanks to [Shannon Moeller](https://github.com/shannonmoeller) for donating the
pkgname "func" on npm!

<br/>

## LICENSE

[MIT](./LICENSE)
