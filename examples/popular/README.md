# popular example

This example tracks the official func template so users can compare generated
projects with a checked-in reference. It includes example commands, typed
options, local development, tests, and production builds.

[Documentation](https://func.witt.im) ·
[Quick Start](https://func.witt.im/guide) ·
[中文文档](https://func.witt.im/zh-cn)

The bundled-size reference for the current example output lives at
[`archived.tar.gz`](./archived.tar.gz).

## Usage

1. Install dependencies with `npm install`.

2. Run locally with `npm run dev -- --help`.

3. Try options such as `npm run dev -- --mode prod --tag func`.

4. Run `npm test` to build the CLI and execute its tests.

## Build

Run `npm run build` to generate the production CLI in `dist`.

Run `npm run format` to format the project files.
