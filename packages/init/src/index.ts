import args from 'args'
import { createProject } from './project'

export const main = async (argv: string[] = process.argv): Promise<void> => {
  const normalizedArgv = normalizeArgv(argv)

  args.example('npm init func', 'Prompt for a project name')

  args.parse(normalizedArgv, {
    name: 'create-func',
  } as Parameters<typeof args.parse>[1])

  assertNoProjectNameArg(args.sub)

  await createProject()
}

export const normalizeArgv = (argv: string[]): string[] => {
  if (argv[2] !== '--') {
    return argv
  }

  return argv.slice(0, 2).concat(argv.slice(3))
}

export const assertNoProjectNameArg = (subArgs: string[]): void => {
  if (!subArgs.length) return

  throw new Error('Project name is asked interactively. Run "npm init func".')
}
