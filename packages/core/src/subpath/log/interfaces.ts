export interface LogModuleOptions {
  /** Safe directory segment used in ~/.{appName}/logs. */
  appName: string
  /** Maximum bytes written by one invocation. Defaults to 10 MiB. */
  maxBytes?: number
  /** Maximum retained log files. Set to zero to disable logging. Defaults to 10. */
  maxFiles?: number
}
