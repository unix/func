# Manual end-to-end tests

These fixtures exercise `funcgo` from its TypeScript source in a real terminal.
They are intentionally excluded from the automated test suite.

## Build

From the repository root, run:

```sh
pnpm --filter funcgo test:manual:build
```

The command bundles `manual-e2e/build/src/index.ts`. To verify the generated
executable after the build succeeds, run:

```sh
node packages/funcgo/manual-e2e/build/dist/bin.js
```

## Watch build

From the repository root, run:

```sh
pnpm --filter funcgo test:manual:watch
```

Then edit and save `manual-e2e/watch-build/src/index.ts` to trigger another build.
Several changes within the 200ms debounce window should produce only one rebuild.
Introduce a TypeScript error and fix it again to check the failure and recovery
states. Press `Ctrl+C` to stop watching.
