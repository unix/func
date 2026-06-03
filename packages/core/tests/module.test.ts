import {
  Command,
  CommandMajor,
  FuncModule,
  Handler,
  Service,
  createApp,
  run,
} from '../src'
import { expect, random, test } from './_test'

test.sequential('should run commands from a FuncModule', async () => {
  let invoked = false
  const name = random()

  @Command({ name })
  class BuildCommand {
    @Handler()
    run() {
      invoked = true
    }
  }

  @FuncModule({
    commands: [BuildCommand],
  })
  class AppModule {}

  await run(AppModule, { argv: [name] })

  expect(invoked).toBe(true)
})

test.sequential('should run commands from a plain app config', async () => {
  let invoked = false

  @CommandMajor()
  class Major {
    @Handler()
    run() {
      invoked = true
    }
  }

  await run({ commands: [Major] }, { argv: [] })

  expect(invoked).toBe(true)
})

test.sequential('should create a low-level container from a FuncModule', async () => {
  @CommandMajor()
  class Major {
    @Handler()
    run() {}
  }

  @FuncModule({
    commands: [Major],
  })
  class AppModule {}

  expect(createApp(AppModule)).toEqual(expect.objectContaining({ run: expect.any(Function) }))
})

test.sequential('should inject services registered by a feature module', async () => {
  let message = ''
  const name = random()

  @Service()
  class FeatureService {
    text() {
      return 'feature-service'
    }
  }

  @Command({ name })
  class FeatureCommand {
    constructor(private service: FeatureService) {}

    @Handler()
    run() {
      message = this.service.text()
    }
  }

  @FuncModule({
    commands: [FeatureCommand],
    services: [FeatureService],
  })
  class FeatureModule {}

  @FuncModule({
    imports: [FeatureModule],
  })
  class AppModule {}

  await run(AppModule, { argv: [name] })

  expect(message).toBe('feature-service')
})

test.sequential('should inject dependencies between registered services', async () => {
  let invoked = false
  const name = random()

  @Service()
  class ProjectService {
    name() {
      return name
    }
  }

  @Service()
  class FeatureService {
    constructor(private project: ProjectService) {}

    matches(input: string) {
      return this.project.name() === input
    }
  }

  @Command({ name })
  class FeatureCommand {
    constructor(private service: FeatureService) {}

    @Handler()
    run() {
      invoked = this.service.matches(name)
    }
  }

  @FuncModule({
    commands: [FeatureCommand],
    services: [ProjectService, FeatureService],
  })
  class AppModule {}

  await run(AppModule, { argv: [name] })

  expect(invoked).toBe(true)
})
