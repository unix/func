import type { ParsedUserOption, UserOption } from '../options/types'

export const createOptionRecord = (
  definitions: readonly { readonly name: string }[],
): ParsedUserOption => {
  const options: ParsedUserOption = {}
  Object.setPrototypeOf(options, null)
  definitions.forEach(({ name }) => {
    options[name] = undefined
  })
  return options
}

export const snapshotOptions = <Options extends UserOption>(
  options: Options,
): Readonly<Options> => {
  const snapshot = { ...options }
  Object.setPrototypeOf(snapshot, null)
  Object.keys(options).forEach(key => {
    const value = options[key]
    if (Array.isArray(value)) {
      Reflect.set(snapshot, key, Object.freeze(value.slice()))
    }
  })
  return Object.freeze(snapshot)
}
