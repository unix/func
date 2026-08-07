# Published ecosystem tests

This suite validates the public `func` ecosystem as an npm consumer sees it. It
does not import workspace sources, pack local packages, use pnpm, or create a
repository lockfile.

Each run:

1. copies the fixture into a fresh system temporary directory;
2. installs `func@latest` and `funcgo@latest` with npm;
3. verifies npm registry resolution and rejects linked package directories;
4. checks the complete CommonJS, ES module, and TypeScript API surface;
5. exercises `funcgo` help, version, setup, development, Rolldown, ncc, and
   watch workflows; and
6. runs the same CLI behavior contract against every completed build.

The temporary npm lockfile is inspected to prove that both packages came from
HTTP(S) registry tarballs, then removed together with the temporary project.
The test intentionally requires network access and always targets the current
npm `latest` tags.

Run it from the repository root:

```sh
npm run test:ecosystem
```

Or run this directory directly:

```sh
npm test --prefix ecosystem-tests
```
