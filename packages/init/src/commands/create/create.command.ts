import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import { Args, CommandMajor, CommandMissing, Ctx, Handler } from 'func'
import type { Args as CommandArgs, Context } from 'func'
import { CreateService } from './create.service'

@CommandMajor()
export class CreateProjectCommand {
  constructor(private readonly createService: CreateService) {}

  @Handler()
  async run(@Ctx() context: Context): Promise<void> {
    await this.createService.create(undefined, context)
  }
}

@CommandMissing()
export class CreateNamedProjectCommand {
  constructor(private readonly createService: CreateService) {}

  @Handler()
  async run(@Args() args: CommandArgs, @Ctx() context: Context): Promise<void> {
    await this.createService.create(resolveProjectName(args.inputs), context)
  }
}

export const resolveProjectName = (
  inputs: readonly string[],
): string | undefined => {
  if (inputs.length > 1) {
    throw new ScaffoldException(SCAFFOLD.MULTIPLE_PROJECT_NAMES, {
      details: { names: inputs },
      message: 'Only one project name can be provided.',
    })
  }

  return inputs[0]
}
