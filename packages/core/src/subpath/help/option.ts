import { Context } from '../../context'
import { Args, Inject } from '../../injection'
import type { Args as CommandArgs } from '../../interfaces'
import { Handler } from '../../commands'
import { OptionCommand } from '../../options'
import { HelpContext } from './context'
import { HelpFormatter } from './formatter'
import type { HelpMeta } from './interfaces'

export interface HelpTransform {
  transform(meta: HelpMeta, context: HelpContext): HelpMeta | Promise<HelpMeta>
}

@OptionCommand({ alias: 'h', description: 'show help', name: 'help' })
export class HelpOption implements HelpTransform {
  transform(meta: HelpMeta, context: HelpContext): HelpMeta | Promise<HelpMeta> {
    void context
    return meta
  }

  @Handler()
  private async handle(
    @Args() args: CommandArgs,
    @Inject(Context) context: Context,
  ): Promise<void> {
    const helpContext = new HelpContext(args, context)
    const meta = await this.transform(helpContext.createMeta(), helpContext)
    context.io.stdout.write(HelpFormatter.format(meta))
  }
}
