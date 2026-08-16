import {
  complete,
  completionEnvironmentVariable,
  completionSource,
  withCompletion,
} from 'func/completion'

if (
  typeof complete !== 'function' ||
  completionEnvironmentVariable('ship') !== '_SHIP_COMPLETE' ||
  !completionSource('ship', 'bash').includes('complete -o default') ||
  typeof withCompletion !== 'function'
) {
  throw new Error('completion subpath is incomplete')
}

console.log('completion-entry')
