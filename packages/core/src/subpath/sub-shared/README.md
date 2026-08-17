# Subpath shared internals

This directory contains internal code shared by two or more independent
subpath entries, but not used by the `func` main entry.

Config and Log use the shared application-directory validation and
invocation-local resource initialization in this directory. The main entry only
collects and forwards `appName`.

- Code used by the main entry belongs in `src/shared` or in its owning main
  package domain.
- Code used by only one subpath stays beside that subpath.
- A nested subpath keeps code owned by its parent domain beside the parent. For
  example, shared implementation between `process` and `process/testing`
  remains under `subpath/process`.
- Nothing in this directory is a public package export.
