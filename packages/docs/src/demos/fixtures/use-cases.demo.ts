import {
  Args,
  ArrayValue,
  Command,
  CommandMissing,
  Enum,
  Flag,
  FuncModule,
  Handler,
  Required,
  Value,
  type FuncArgs,
} from '../../../../core/src'

@Command({
  name: 'status',
  description: 'Print service status',
})
class StatusCommand {
  @Handler()
  run() {
    console.log('All systems operational')
  }
}

@Command({
  name: 'domain',
  description: 'Manage custom domains',
})
class DomainCommand {
  @Handler({ path: ['add'] })
  add() {
    console.log('Adding domain')
  }
}

@Command({
  name: 'register',
  description: 'Register a domain and optional checks',
})
class RegisterCommand {
  @Flag({ description: 'Create an issue after registration' })
  issue = false

  @Flag({ description: 'Run DNS checks' })
  dns = false

  @Required()
  @Value({ type: String })
  domain?: string

  @Handler()
  run() {
    console.log(this.domain, {
      issue: this.issue,
      dns: this.dns,
    })
  }
}

@CommandMissing()
class UserSearchFallback {
  @Flag({ description: 'Include profile details' })
  includeProfile = false

  @Flag({ description: 'Only return verified users' })
  verified = false

  @Handler()
  async search(@Args() args: FuncArgs) {
    const [username, ...aliases] = args.inputs
    console.log('Searching user:', {
      username,
      aliases,
      includeProfile: this.includeProfile,
      verified: this.verified,
    })
  }
}

const MACHINES = ['1x-1024m', '1x-2048m', '2x-1024m', '2x-2048m']

@Command({
  name: 'scale',
  description: 'Scale machines',
})
class ScaleCommand {
  @Enum(MACHINES)
  @ArrayValue({ name: 'machine' })
  machines: string[] = []

  @Handler()
  run() {
    console.log('Scaling to:', this.machines)
  }
}

@FuncModule({
  commands: [
    StatusCommand,
    DomainCommand,
    RegisterCommand,
    UserSearchFallback,
    ScaleCommand,
  ],
})
export class UseCasesModule {}
