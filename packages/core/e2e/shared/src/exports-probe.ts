import * as library from 'func'

const callableApis = [
  'Args',
  'ArrayNumber',
  'ArrayString',
  'Command',
  'CommandMajor',
  'CommandMissing',
  'Ctx',
  'Deprecated',
  'DependsOn',
  'Enum',
  'Exclusive',
  'Flag',
  'Module',
  'Handler',
  'Inject',
  'Injectable',
  'Option',
  'OptionCommand',
  'Override',
  'Required',
  'Stderr',
  'Stdin',
  'Stdout',
  'Value',
  'ValueValidate',
  'createApp',
  'createToken',
  'createValueDecorator',
] as const

console.log(
  JSON.stringify({
    callableApis: callableApis.filter(api => typeof library[api] === 'function'),
    runtimeApis: Object.keys(library)
      .filter(api => api !== 'default')
      .sort(),
  }),
)
