import type { ArgsOptionValue, UserOption } from '../interfaces'

export const createOptionRecord = (
  definitions: readonly { readonly name: string }[],
): UserOption => {
  const options: UserOption = {}
  Object.setPrototypeOf(options, null)
  definitions.forEach(({ name }) => {
    options[name] = undefined
  })
  return options
}

export const snapshotOptions = (
  options: UserOption,
): Readonly<Record<string, ArgsOptionValue>> => {
  const snapshot: Record<string, ArgsOptionValue> = {}
  Object.setPrototypeOf(snapshot, null)
  Object.keys(options).forEach(key => {
    const value = options[key]
    snapshot[key] = Array.isArray(value) ? Object.freeze(value.slice()) : value
  })
  return Object.freeze(snapshot)
}
