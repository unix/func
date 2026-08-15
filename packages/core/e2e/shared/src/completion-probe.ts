import {
  complete,
  completionEnvironmentVariable,
  completionSource,
  runWithCompletion,
} from 'func/completion'

if (
  typeof complete !== 'function' ||
  completionEnvironmentVariable('ship') !== '_SHIP_COMPLETE' ||
  !completionSource('ship', 'bash').includes('complete -o default') ||
  typeof runWithCompletion !== 'function'
) {
  throw new Error('completion subpath is incomplete')
}

console.log('completion-entry')
