# Ecosystem tests

Tests the latest npm releases of `func` and `funcgo`, including public APIs and
the setup, development, build, ncc, and watch workflows.

The test requires network access. Packages, builds, and lockfiles stay in a
temporary directory; workspace links are never used and repository files are
never modified.

```sh
cd ecosystem-tests
npm test
```
