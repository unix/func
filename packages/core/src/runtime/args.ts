export type ArgsOptionValue =
  boolean | string | number | readonly string[] | readonly number[] | undefined

export interface Args {
  readonly inputs: readonly string[]
  readonly invokedPath: readonly string[]
  readonly options: Readonly<Record<string, ArgsOptionValue>>
  readonly path: readonly string[]
  readonly raw: readonly string[]
}
