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
  'Stdout',
  'Value',
  'ValueValidate',
  'createApp',
  'createToken',
] as const

console.log(
  JSON.stringify({
    callableApis: callableApis.filter(api => typeof library[api] === 'function'),
    runtimeApis: Object.keys(library)
      .filter(api => api !== 'default')
      .sort(),
  }),
)
