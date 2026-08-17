export type ParserOptionType =
  BooleanConstructor | NumberConstructor | StringConstructor

interface ParserOptionBase<Type extends ParserOptionType> {
  readonly alias?: string
  readonly aliases?: readonly string[]
  readonly name?: string
  readonly type: Type
}

export interface ParserBooleanOption extends ParserOptionBase<BooleanConstructor> {
  readonly multiple?: never
  readonly negatable?: boolean
}

export interface ParserValueOption extends ParserOptionBase<
  NumberConstructor | StringConstructor
> {
  readonly multiple?: boolean
  readonly negatable?: never
}

export type ParserOption = ParserOptionType | ParserBooleanOption | ParserValueOption

export interface ParserOptions {
  readonly [key: string]: ParserOption
}

export interface ParserCommand<Options extends ParserOptions = ParserOptions> {
  readonly options?: Options
  readonly passthrough?: boolean
}

export interface ParserCommands {
  readonly [command: string]: ParserCommand
}

export interface ParserDefinition<
  Options extends ParserOptions = ParserOptions,
  Commands extends ParserCommands = ParserCommands,
> {
  readonly commands?: Commands
  readonly options?: Options
}

export type ParserErrorCode =
  'invalid-argument' | 'invalid-definition' | 'unknown-command' | 'unknown-option'

export class ParserError extends Error {
  constructor(
    readonly code: ParserErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message)
    this.name = 'ParserError'
  }
}

type OptionConstructor<Option> = Option extends ParserOptionType
  ? Option
  : Option extends { readonly type: infer Type extends ParserOptionType }
    ? Type
    : never

type ParsedOption<Option> =
  OptionConstructor<Option> extends BooleanConstructor
    ? boolean
    : Option extends { readonly multiple: true }
      ? OptionConstructor<Option> extends NumberConstructor
        ? readonly number[]
        : readonly string[]
      : OptionConstructor<Option> extends NumberConstructor
        ? number | undefined
        : string | undefined

export type ParsedOptions<Options extends ParserOptions> = {
  readonly [Key in keyof Options]: ParsedOption<Options[Key]>
}

type CommandOptions<Command> = Command extends {
  readonly options: infer Options extends ParserOptions
}
  ? Options
  : Record<never, never>

type Simplify<Value> = { readonly [Key in keyof Value]: Value[Key] }

export interface ParserInvocation<
  Command extends string | undefined,
  Options extends ParserOptions,
> {
  readonly command: Command
  readonly inputs: readonly string[]
  readonly options: ParsedOptions<Options>
  readonly supplied: ReadonlySet<keyof Options & string>
}

type CommandInvocation<
  Options extends ParserOptions,
  Commands extends ParserCommands,
> = {
  [Command in keyof Commands & string]: ParserInvocation<
    Command,
    Simplify<Options & CommandOptions<Commands[Command]>>
  >
}[keyof Commands & string]

export type ParserResult<
  Options extends ParserOptions,
  Commands extends ParserCommands,
> = ParserInvocation<undefined, Options> | CommandInvocation<Options, Commands>

export interface Parser<
  Options extends ParserOptions,
  Commands extends ParserCommands,
> {
  parse(argv: readonly string[]): ParserResult<Options, Commands>
}
