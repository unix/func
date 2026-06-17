import pkg from '../package.json'

export const config = {
  package: {
    name: pkg.name,
    version: pkg.version,
  },
  runtime: {
    modes: ['dev', 'prod'],
    defaultMode: 'dev',
  },
  greeting: {
    defaultName: 'friend',
  },
}
