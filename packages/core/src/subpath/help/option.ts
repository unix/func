import { Context } from '../../runtime/context'
import { Args, Ctx, Stdout } from '../../runtime/injection'
import type { Args as CommandArgs } from '../../runtime/args'
import { Handler } from '../../commands'
import { OptionCommand } from '../../options'
import { HelpContext } from './context'
import { HelpFormatter } from './formatter'
import type { HelpMeta } from './interfaces'
import type { Writable } from 'node:stream'

export interface HelpTransform {
  transform(meta: HelpMeta, context: HelpContext): HelpMeta | Promise<HelpMeta>
}

@OptionCommand({
  alias: 'h',
  description: 'show help',
  name: 'help',
  textOutput: 'stdout',
})
export class HelpOption implements HelpTransform {
  transform(meta: HelpMeta, context: HelpContext): HelpMeta | Promise<HelpMeta> {
    void context
    return meta
  }

  @Handler()
  private async handle(
    @Args() args: CommandArgs,
    @Ctx() context: Context,
    @Stdout() stdout: Writable,
  ): Promise<HelpMeta> {
    const helpContext = new HelpContext(args, context)
    const meta = await this.transform(helpContext.createMeta(), helpContext)
    stdout.write(HelpFormatter.format(meta))
    return meta
  }
}
