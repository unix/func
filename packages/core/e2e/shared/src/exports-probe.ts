import * as library from 'func'

const callableApis = [
  'Args',
  'ArrayValue',
  'Catch',
  'CatchAll',
  'Command',
  'CommandError',
  'CommandMajor',
  'CommandMissing',
  'Container',
  'DependsOn',
  'Enum',
  'Exception',
  'Exclusive',
  'Flag',
  'FuncModule',
  'Handler',
  'Regs',
  'Required',
  'Service',
  'SubOptions',
  'Value',
  'ValueValidate',
  'createApp',
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
