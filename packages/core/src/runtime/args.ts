export type ArgsOptionValue =
  boolean | string | number | readonly string[] | readonly number[] | undefined

export interface Args<
  Options extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, ArgsOptionValue>
  >,
> {
  readonly inputs: readonly string[]
  readonly invokedPath: readonly string[]
  readonly options: Readonly<Options>
  readonly path: readonly string[]
  readonly raw: readonly string[]
}
