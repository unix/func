import type { RegisterCommandParams } from './types'

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export type CommandInfo = DeepReadonly<RegisterCommandParams>

export const createCommandInfo = (command: RegisterCommandParams): CommandInfo =>
  Object.freeze({
    ...command,
    aliases: Object.freeze(command.aliases.slice()),
    ...(command.fieldOptions
      ? {
          fieldOptions: Object.freeze(command.fieldOptions.map(readonlyFieldOption)),
        }
      : {}),
    path: Object.freeze(command.path.slice()),
  })

const readonlyFieldOption = (
  option: NonNullable<RegisterCommandParams['fieldOptions']>[number],
): DeepReadonly<NonNullable<RegisterCommandParams['fieldOptions']>[number]> => {
  const fieldOption = { ...option }
  Reflect.deleteProperty(fieldOption, 'transform')
  Reflect.deleteProperty(fieldOption, 'validators')
  const constraints = {
    ...(fieldOption.dependsOn
      ? { dependsOn: Object.freeze(fieldOption.dependsOn.slice()) }
      : {}),
    ...(fieldOption.enum ? { enum: Object.freeze(fieldOption.enum.slice()) } : {}),
    ...(fieldOption.exclusive
      ? { exclusive: Object.freeze(fieldOption.exclusive.slice()) }
      : {}),
  }
  const aliases = Object.freeze(fieldOption.aliases.slice())
  if (fieldOption.kind === 'array') {
    return Object.freeze({
      ...fieldOption,
      aliases,
      ...constraints,
      type: Object.freeze(fieldOption.type.slice()),
    })
  }
  return Object.freeze({ ...fieldOption, aliases, ...constraints })
}
