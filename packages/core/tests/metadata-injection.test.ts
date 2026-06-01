import { expect, random, test } from './_test'
import { Option, OptionArgsProvider } from '../src'
import { metadata } from '../src/utils/metadata'

test('should emit constructor param metadata for decorated handlers', () => {
  @Option({ name: random() })
  class GetOption {
    constructor(_arg: OptionArgsProvider) {}
  }

  const paramTypes = Reflect.getMetadata(metadata.DESIGN_PARAM_TYPES, GetOption)

  expect(paramTypes).toEqual([OptionArgsProvider])
})
