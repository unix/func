import { expect, random, test } from './_test'
import { Option, OptionArgsProvider } from '../src'

test.sequential('should invoke option when number value is zero', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Option({ name, type: Number })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      expect(arg.value).toBe(0)
      expect(arg.native[`--${name}`]).toBe(0)
    }
  }

  runContainer(['', '', `--${name}`, '0'], [GetOption])
})

test.sequential('should invoke option when string value is empty', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  @Option({ name, type: String })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      expect(arg.value).toBe('')
      expect(arg.native[`--${name}`]).toBe('')
    }
  }

  runContainer(['', '', `--${name}`, ''], [GetOption])
})

test.sequential('should invoke option by alias when number value is zero', ({ runContainer }) => {
  expect.assertions(2)
  const name = random()
  const alias = 'z'
  @Option({ name, alias, type: Number })
  class GetOption {
    constructor(arg: OptionArgsProvider) {
      expect(arg.value).toBe(0)
      expect(arg.native[`--${name}`]).toBe(0)
    }
  }

  runContainer(['', '', `-${alias}`, '0'], [GetOption])
})
