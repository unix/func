import args from 'args'
import { createProject } from './project'

export const main = async (argv: string[] = process.argv): Promise<void> => {
  args
    .example('npm init func@latest', 'Prompt for a project name')
    .example('npm init func@latest my-app', 'Create a project without prompting')

  Reflect.apply(args.parse, args, [argv, { name: 'create-func' }])
  await createProject(resolveProjectName(args.sub))
}

export const resolveProjectName = (subArgs: string[]): string | undefined => {
  if (subArgs.length > 1) {
    throw new Error('Only one project name can be provided.')
  }

  return subArgs[0]
}
