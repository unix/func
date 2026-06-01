import { expect, test as baseTest } from 'vitest'
import { Container } from '../src'
import type { ContainerParams } from '../src/containers/container'
import { random } from './_utils'

interface Fixtures {
  runContainer: (argv: string[], handlers: ContainerParams) => Container
  setArgv: (argv: string[]) => void
}

const test = baseTest.extend<Fixtures>({
  setArgv: async ({}, use) => {
    const original = process.argv

    await use(argv => {
      process.argv = argv
    })

    process.argv = original
  },
  runContainer: async ({ setArgv }, use) => {
    await use((argv, handlers) => {
      setArgv(argv)
      return new Container(handlers)
    })
  },
})

export { expect, random, test }
