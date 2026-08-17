import { createParser } from 'func/parser'

export const funcgoParser = createParser({
  options: {
    help: { alias: 'h', type: Boolean },
    version: { alias: 'v', type: Boolean },
  },
  commands: {
    build: {
      options: {
        external: { alias: 'e', multiple: true, type: String },
        file: { alias: 'f', type: String },
        out: { alias: 'o', type: String },
        watch: { alias: 'w', type: Boolean },
        watchPaths: {
          multiple: true,
          name: 'watch-path',
          type: String,
        },
      },
    },
    dev: {
      options: {
        file: { alias: 'f', type: String },
      },
      passthrough: true,
    },
    setup: {
      options: {
        fix: Boolean,
      },
    },
  },
})
