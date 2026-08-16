import { withProcessSignals } from 'func/signals'

if (typeof withProcessSignals !== 'function') {
  throw new Error('signals subpath is incomplete')
}

console.log('signals-entry')
