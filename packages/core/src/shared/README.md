# Shared internals

This directory contains internal code that is used by the `func` main entry and
may also be reused by one or more subpath entries.

- Code must not be placed here unless it is part of the main entry's dependency
  graph.
- Code used only by subpaths belongs in `src/subpath/sub-shared` when it is
  shared, or beside its owning subpath when it is not.
- Test-only usage does not make code part of the main package.
