import { styleText } from 'node:util'

export type StyleStream = NodeJS.WritableStream

const output: StyleStream = process.stdout
const errorOutput: StyleStream = process.stderr

const styled = (
  format: Parameters<typeof styleText>[0],
  text: string,
  stream: StyleStream,
): string => styleText(format, text, { stream })

export const style = {
  accent: (text: string, stream: StyleStream = output): string =>
    styled('cyan', text, stream),
  danger: (text: string, stream: StyleStream = errorOutput): string =>
    styled('red', text, stream),
  dim: (text: string, stream: StyleStream = output): string =>
    styled('dim', text, stream),
  error: (text: string, stream: StyleStream = errorOutput): string =>
    styled(['red', 'bold'], text, stream),
  heading: (text: string, stream: StyleStream = output): string =>
    styled('bold', text, stream),
  success: (text: string, stream: StyleStream = output): string =>
    styled(['green', 'bold'], text, stream),
  warning: (text: string, stream: StyleStream = errorOutput): string =>
    styled('yellow', text, stream),
}
