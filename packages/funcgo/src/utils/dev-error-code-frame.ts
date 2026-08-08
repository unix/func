import fs from 'fs'
import type { ErrorLocation } from './dev-error-location'
import { style } from './style'
import type { StyleStream } from './style'

export interface CodeFrameOptions {
  contextLines?: number
  highlight?: string
  stream?: StyleStream
}

export const formatCodeFrame = (
  location: ErrorLocation,
  options: CodeFrameOptions = {},
): string | undefined => {
  try {
    const lines = fs.readFileSync(location.file, 'utf-8').split(/\r?\n/)
    if (location.line < 1 || location.line > lines.length) return undefined

    const contextLines = options.contextLines ?? 2
    const start = Math.max(1, location.line - contextLines)
    const end = Math.min(lines.length, location.line + contextLines)
    const gutterWidth = String(end).length
    const stream = options.stream || process.stderr
    const sourceLine = lines[location.line - 1]
    const highlightColumn = options.highlight
      ? sourceLine.indexOf(options.highlight)
      : -1
    const column =
      highlightColumn >= 0 ? highlightColumn : Math.max(0, location.column - 1)
    const highlightLength = Math.max(1, options.highlight?.length || 1)
    const caret = `  ${''.padStart(gutterWidth)} ${style.dim('|', stream)} ${' '.repeat(column)}${style.danger('^'.repeat(highlightLength), stream)}`
    const frame = Array.from(
      { length: end - start + 1 },
      (_, index) => start + index,
    ).flatMap(line => {
      const isTarget = line === location.line
      const marker = isTarget ? style.danger('>', stream) : ' '
      const lineNumber = String(line).padStart(gutterWidth)
      const styledLineNumber = isTarget
        ? style.danger(lineNumber, stream)
        : style.dim(lineNumber, stream)
      const renderedLine = `${marker} ${styledLineNumber} ${style.dim('|', stream)} ${lines[line - 1]}`
      if (!isTarget) return [renderedLine]

      return [renderedLine, caret]
    })

    return frame.join('\n')
  } catch {
    return undefined
  }
}
