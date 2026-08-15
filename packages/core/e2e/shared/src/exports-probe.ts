import * as library from 'func'

const callableApis = [
  'Args',
  'ArrayNumber',
  'ArrayString',
  'Command',
  'CommandMajor',
  'CommandMissing',
  'Container',
  'Deprecated',
  'DependsOn',
  'Enum',
  'Exclusive',
  'Flag',
  'Module',
  'Handler',
  'Inject',
  'Injectable',
  'Required',
  'Value',
  'ValueValidate',
  'createApp',
  'createToken',
  'run',
] as const

console.log(
  JSON.stringify({
    callableApis: callableApis.filter(api => typeof library[api] === 'function'),
    runtimeApis: Object.keys(library)
      .filter(api => api !== 'default')
      .sort(),
  }),
)
