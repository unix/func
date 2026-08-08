import { style } from './style'

const output = process.stdout
const errorOutput = process.stderr

let active = false

const writeLine = (
  text: string = '',
  stream: NodeJS.WritableStream = output,
): void => {
  stream.write(`${text}\n`)
}

export const start = (text: string): void => {
  active = true
  writeLine(`  ${style.accent('◇')} ${style.heading(text)}`)
}

export const succeed = (text: string): void => {
  if (!active) return
  writeLine(`  ${style.success('✓')} ${style.success(text)}`)
  active = false
}

export const fail = (text: string): void => {
  if (!active) return

  writeLine(
    `  ${style.danger('✗', errorOutput)} ${style.error(text, errorOutput)}`,
    errorOutput,
  )
  active = false
}

export const info = (text: string, detail?: string): void => {
  writeLine()
  writeLine(`  ${style.accent('●')} ${style.heading(text)}`)
  if (!detail) return
  writeLine(`    ${style.dim(detail)}`)
}

export const error = (text: string, detail?: string): void => {
  writeLine(
    `  ${style.danger('✗', errorOutput)} ${style.error(text, errorOutput)}`,
    errorOutput,
  )
  if (!detail) return
  writeLine(`    ${style.danger(detail, errorOutput)}`, errorOutput)
}

export const detail = (text: string): void => {
  writeLine(`    ${style.danger(text, errorOutput)}`, errorOutput)
}

export const newline = (): void => {
  writeLine()
}
