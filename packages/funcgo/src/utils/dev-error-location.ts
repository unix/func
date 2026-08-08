import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export interface ErrorLocation {
  column: number
  file: string
  line: number
}

export interface ResolveErrorLocationOptions {
  cwd: string
  property?: string
}

interface StackFrame extends ErrorLocation {
  index: number
  raw: string
  sourceLine?: string
}

const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/
const STACK_HELPER = /\b(?:__decorate|DecorateProperty|Reflect\.decorate)\b/

export const resolveErrorLocation = (
  error: unknown,
  options: ResolveErrorLocationOptions,
): ErrorLocation | undefined => {
  const stack = errorStack(error)
  if (!stack) return undefined
  const cwd = path.resolve(options.cwd)
  const frames = stack
    .split('\n')
    .map((line, index) => parseStackFrame(line, index))
    .filter((frame): frame is StackFrame => Boolean(frame))
    .filter(frame => isProjectFrame(frame.file, cwd))
    .map(frame =>
      Object.assign(frame, { sourceLine: readSourceLine(frame.file, frame.line) }),
    )
  if (!frames.length) return undefined

  const frame = frames.reduce((best, candidate) =>
    scoreFrame(candidate, options.property) > scoreFrame(best, options.property)
      ? candidate
      : best,
  )

  return {
    column: frame.column,
    file: frame.file,
    line: frame.line,
  }
}

const errorStack = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined
  if (!('stack' in error) || typeof error.stack !== 'string') return undefined
  return error.stack
}

const parseStackFrame = (line: string, index: number): StackFrame | undefined => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('at ')) return undefined
  let location = trimmed.slice(3)
  const openingParenthesis = location.lastIndexOf('(')
  if (openingParenthesis >= 0 && location.endsWith(')')) {
    location = location.slice(openingParenthesis + 1, -1)
  } else {
    location = location.replace(/^async\s+/, '')
  }

  const match = /^(.*):(\d+):(\d+)$/.exec(location)
  if (!match) return undefined
  const file = resolveStackFile(match[1])
  if (!file) return undefined

  return {
    column: Number(match[3]),
    file,
    index,
    line: Number(match[2]),
    raw: trimmed,
  }
}

const resolveStackFile = (file: string): string | undefined => {
  if (file.startsWith('file://')) {
    try {
      return fileURLToPath(file)
    } catch {
      return undefined
    }
  }
  if (!path.isAbsolute(file)) return undefined
  return path.normalize(file)
}

const isProjectFrame = (file: string, cwd: string): boolean => {
  const relative = path.relative(cwd, file)
  if (!relative || relative === '..') return false
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
  return !relative.split(path.sep).includes('node_modules')
}

const readSourceLine = (file: string, line: number): string | undefined => {
  try {
    return fs.readFileSync(file, 'utf-8').split(/\r?\n/)[line - 1]
  } catch {
    return undefined
  }
}

const scoreFrame = (frame: StackFrame, property?: string): number => {
  let score = -frame.index
  if (SOURCE_EXTENSION.test(frame.file)) score += 20
  if (frame.sourceLine) score += 10
  if (property && containsProperty(frame.sourceLine, property)) score += 100
  if (STACK_HELPER.test(frame.raw)) score -= 50
  return score
}

const containsProperty = (
  sourceLine: string | undefined,
  property: string,
): boolean => {
  if (!sourceLine) return false
  return new RegExp(`\\b${escapeRegExp(property)}\\b`).test(sourceLine)
}

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
