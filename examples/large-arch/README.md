# large-arch example

This example shows an architecture for larger func projects. It groups code by
feature module instead of keeping all commands and services in global folders.

Each feature owns its service, module, and commands:

```text
src
|-- app.module.ts
|-- index.ts
|-- deployments
|   |-- deployments.command.ts
|   |-- deployments.module.ts
|   +-- deployments.service.ts
|-- reports
|   |-- reports.command.ts
|   |-- reports.module.ts
|   +-- reports.service.ts
+-- users
    |-- users.command.ts
    |-- users.module.ts
    +-- users.service.ts
```

Use this shape when a project has many domains or teams and each feature needs
to keep its command surface and business logic together.

## Usage

1. Install dependencies with `npm install`.

2. Run locally with commands such as:

```sh
npm run dev -- users --role admin
npm run dev -- reports export --period month
npm run dev -- deployments release --env prod --dry-run
```

3. Build with `npm run build`.
