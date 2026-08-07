import args from 'args'
import { createProject } from './project'

export const main = async (argv: string[] = process.argv): Promise<void> => {
  args
    .example('npm init func@latest', 'Prompt for a project name')
    .example('npm init func@latest my-app', 'Create a project without prompting')

  args.parse(argv, {
    name: 'create-func',
  } as Parameters<typeof args.parse>[1])

  await createProject(resolveProjectName(args.sub))
}

export const resolveProjectName = (subArgs: string[]): string | undefined => {
  if (subArgs.length > 1) {
    throw new Error('Only one project name can be provided.')
  }

  return subArgs[0]
}
