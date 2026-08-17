import type { OptionParams } from '../options/types'
import type { ArgOption, ArgToken, ArgValueType, ArgvPlan } from './interfaces'

export interface ArgvPlanDefinition {
  readonly option: OptionParams
  readonly owner: string
}

export class ArgTokenConflict extends Error {
  constructor(
    readonly token: string,
    readonly firstOwner: string,
    readonly secondOwner: string,
  ) {
    super(`Duplicate option token "${token}".`)
  }
}

export const compileArgvPlan = (
  definitions: readonly ArgvPlanDefinition[],
): ArgvPlan => {
  const options: ArgOption[] = []
  const tokens = new Map<string, ArgToken>()
  const owners = new Map<string, string>()
  definitions.forEach(definition => {
    const option = compileOption(definition.option)
    options.push(option)
    registerToken(tokens, owners, `--${option.name}`, definition.owner, {
      ...(option.type === 'boolean' ? { booleanValue: true } : {}),
      option,
    })
    if (definition.option.negatable === true) {
      registerToken(tokens, owners, `--no-${option.name}`, definition.owner, {
        booleanValue: false,
        option,
      })
    }
    definition.option.aliases.forEach(alias => {
      registerToken(tokens, owners, `-${alias}`, definition.owner, {
        ...(option.type === 'boolean' ? { booleanValue: true } : {}),
        option,
      })
    })
  })

  return { options, tokens }
}

const compileOption = (option: OptionParams): ArgOption => {
  const multiple = typeof option.type !== 'function'
  const constructor =
    typeof option.type === 'function' ? option.type : option.type[0]
  let type: ArgValueType = 'string'
  if (constructor === Boolean) type = 'boolean'
  if (constructor === Number) type = 'number'
  return { multiple, name: option.name, type }
}

const registerToken = (
  tokens: Map<string, ArgToken>,
  owners: Map<string, string>,
  token: string,
  owner: string,
  value: ArgToken,
) => {
  const existing = owners.get(token)
  if (existing) throw new ArgTokenConflict(token, existing, owner)
  tokens.set(token, value)
  owners.set(token, owner)
}
