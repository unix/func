import { stripVTControlCharacters } from 'node:util'
import type { Deprecation } from '../../interfaces'
import type {
  HelpCommandMeta,
  HelpMeta,
  HelpOptionMeta,
  HelpUsageMeta,
} from './interfaces'

interface HelpRow {
  description?: string
  label: string
}

export class HelpFormatter {
  // Formatter APIs conventionally use format().
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static format(meta: HelpMeta): string {
    const lines: string[] = []
    if (meta.title) lines.push(meta.title)
    if (meta.description) lines.push(meta.description)
    if (meta.deprecated) lines.push(deprecationLabel(meta.deprecated, true))
    appendSection(lines, 'Usage', meta.usage.map(usageRow))
    appendSection(lines, 'Commands', meta.commands.map(commandRow))
    appendSection(lines, 'Options', meta.options.map(optionRow))
    return `${lines.join('\n')}\n`
  }
}

const appendSection = (lines: string[], title: string, rows: readonly HelpRow[]) => {
  if (!rows.length) return
  if (lines.length) lines.push('')
  lines.push(`${title}:`)
  const width = Math.max(...rows.map(row => visibleWidth(row.label)))
  rows.forEach(row => {
    const padding = ' '.repeat(width - visibleWidth(row.label))
    lines.push(
      row.description
        ? `  ${row.label}${padding}  ${row.description}`
        : `  ${row.label}`,
    )
  })
}

const commandRow = (command: HelpCommandMeta): HelpRow => ({
  description: rowDescription(command.description, command.deprecated),
  label: [command.name, ...command.aliases].join(', '),
})

const optionRow = (option: HelpOptionMeta): HelpRow => {
  const aliases = option.aliases.map(alias => `-${alias}`)
  const value = optionValue(option)
  const names = [`--${option.name}${value}`]
  if (option.negatable) names.push(`--no-${option.name}`)
  return {
    description: optionDescription(option),
    label: aliases.concat(names).join(', '),
  }
}

const usageRow = (usage: HelpUsageMeta): HelpRow => {
  const segments = usage.path.slice()
  if (usage.command) segments.push('<command>')
  if (usage.inputs) segments.push('[inputs...]')
  if (usage.options) segments.push('[options]')
  return { label: segments.join(' ') || '[options]' }
}

const optionDescription = (option: HelpOptionMeta): string | undefined => {
  const details: string[] = []
  if (option.deprecated) details.push(deprecationLabel(option.deprecated))
  if (option.required) details.push('required')
  if (option.choices?.length) details.push(`choices: ${option.choices.join(', ')}`)
  if (option.dependsOn?.length) {
    details.push(
      `depends on: ${option.dependsOn.map(name => `--${name}`).join(', ')}`,
    )
  }
  if (option.exclusive?.length) {
    details.push(
      `conflicts with: ${option.exclusive.map(name => `--${name}`).join(', ')}`,
    )
  }
  return (
    [option.description, details.length ? details.join('; ') : undefined]
      .filter((value): value is string => Boolean(value))
      .join(' — ') || undefined
  )
}

const rowDescription = (
  description: string | undefined,
  deprecated: Deprecation | undefined,
): string | undefined => {
  const values = [
    description,
    deprecated ? deprecationLabel(deprecated) : undefined,
  ].filter((value): value is string => Boolean(value))
  return values.join(' — ') || undefined
}

const deprecationLabel = (deprecated: Deprecation, heading = false): string => {
  const label = heading ? 'Deprecated' : 'deprecated'
  return deprecated === true ? label : `${label}: ${deprecated}`
}

const optionValue = (option: HelpOptionMeta): string => {
  if (option.type === 'boolean') return ''
  if (option.kind === 'array') return ` <${option.type.slice(0, -2)}...>`
  if (option.kind === 'value') return ` <${option.type}>`
  return ''
}

const visibleWidth = (value: string): number =>
  stripVTControlCharacters(value).length
