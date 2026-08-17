export interface LogModuleOptions {
  /** Maximum bytes written by one invocation. Defaults to 10 MiB. */
  maxBytes?: number
  /** Maximum retained log files. Set to zero to disable logging. Defaults to 10. */
  maxFiles?: number
}
