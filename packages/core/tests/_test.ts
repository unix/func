import { expect, test as baseTest } from 'vitest'
import { Container } from '../src'
import type { ContainerParams } from '../src/containers/container'
import { random } from './_utils'

interface Fixtures {
  runContainer: (argv: string[], handlers: ContainerParams) => Promise<Container>
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
    await use(async (argv, handlers) => {
      setArgv(argv)
      const container = new Container(handlers)
      await container.run()
      return container
    })
  },
})

export { expect, random, test }
