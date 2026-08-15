import * as func from '../src'
import {
  Args,
  ArrayNumber,
  Command,
  CommandMajor,
  Context,
  Enum,
  Flag,
  Handler,
  Inject,
  Module,
  OptionCommand,
  Required,
  Value,
} from '../src'
import type { Args as CommandArgs } from '../src'
import { stripVTControlCharacters } from 'node:util'
import { HelpContext, HelpFormatter, HelpOption } from '../src/subpath/help'
import type { HelpMeta, HelpTransform } from '../src/subpath/help'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from './_test'

test('should keep help helpers out of the main entry', () => {
  expect('HelpOption' in func).toBe(false)
  expect('HelpContext' in func).toBe(false)
})

test.sequential(
  'should collect root and command help from the active graph',
  async () => {
    let captured: HelpMeta | undefined

    class AppHelp extends HelpOption {
      override transform(meta: HelpMeta): HelpMeta {
        captured = meta
        return meta
      }
    }

    @CommandMajor()
    class MajorCommand {
      @Flag({
        alias: 'j',
        aliases: ['J', 'j'],
        description: 'print JSON output',
        negatable: true,
      })
      json = false

      @Handler()
      run() {}

      @Handler({ description: 'diagnose the application', path: 'doctor' })
      doctor() {}
    }

    @Command({
      alias: 'd',
      aliases: ['dep', 'd'],
      description: 'deploy the application',
      path: 'deploy',
    })
    class DeployCommand {
      @Required()
      @Enum(['preview', 'production'])
      @Value({ description: 'deployment target' })
      target?: string

      @ArrayNumber({ alias: 'p', description: 'deployment ports' })
      port: number[] = []

      @Handler()
      run() {}
    }

    @Module({
      commands: [MajorCommand, DeployCommand],
      options: [AppHelp],
    })
    class AppModule {}

    const app = createTestingApp(AppModule)
    const root = await app.invoke(['--help'])
    expect(root.error).toBeUndefined()
    expect(captured).toMatchObject({
      commands: [
        {
          aliases: ['d', 'dep'],
          description: 'deploy the application',
          name: 'deploy',
          path: ['deploy'],
        },
        {
          aliases: [],
          description: 'diagnose the application',
          name: 'doctor',
          path: ['doctor'],
        },
      ],
      options: [
        {
          aliases: ['h'],
          description: 'show help',
          kind: 'action',
          name: 'help',
          required: false,
          type: 'boolean',
        },
        {
          aliases: ['j', 'J'],
          description: 'print JSON output',
          kind: 'flag',
          name: 'json',
          negatable: true,
          required: false,
          type: 'boolean',
        },
      ],
      path: [],
      title: '',
      usage: [
        { command: false, inputs: true, options: true, path: [] },
        { command: true, inputs: false, options: true, path: [] },
      ],
    })
    expect(Object.isFrozen(captured)).toBe(true)
    expect(Object.isFrozen(captured?.commands)).toBe(true)
    expect(stripVTControlCharacters(root.stdout)).toBe(root.stdout)
    expect(root.stdout).toContain('-j, -J, --json, --no-json')
    const command = await app.invoke(['dep', '--help'])
    expect(command.error).toBeUndefined()
    expect(captured).toMatchObject({
      commands: [],
      description: 'deploy the application',
      options: [
        { kind: 'action', name: 'help' },
        {
          choices: ['preview', 'production'],
          description: 'deployment target',
          kind: 'value',
          name: 'target',
          required: true,
          type: 'string',
        },
        {
          aliases: ['p'],
          description: 'deployment ports',
          kind: 'array',
          name: 'port',
          type: 'number[]',
        },
      ],
      path: ['deploy'],
      title: 'deploy',
    })
    expect(command.stdout).toContain('deploy the application')
    expect(command.stdout).toContain('--target <string>')
    expect(command.stdout).toContain('-p, --port <number...>')
    expect(command.stdout).toContain('choices: preview, production')
  },
)

test.sequential(
  'should let subclasses transform structured values with terminal colors',
  async () => {
    class ColorHelp extends HelpOption {
      override transform(meta: HelpMeta, context: HelpContext): HelpMeta {
        expect(context.args.path).toEqual([])
        expect(context.inputs).toEqual([])
        return {
          ...meta,
          title: '\u001B[36mship\u001B[39m',
          options: meta.options.map(option => ({
            ...option,
            name:
              option.name === 'help'
                ? `\u001B[33m${option.name}\u001B[39m`
                : option.name,
          })),
        }
      }
    }

    @OptionCommand({ description: 'show version', name: 'version' })
    class VersionOption {
      @Handler()
      run() {}
    }

    @Module({ options: [ColorHelp, VersionOption] })
    class AppModule {}

    const result = await createTestingApp(AppModule).invoke(['--help'])
    expect(result.error).toBeUndefined()
    expect(result.stdout).toContain('\u001B[36mship\u001B[39m')
    expect(result.stdout).toContain('--\u001B[33mhelp\u001B[39m')
    expect(stripVTControlCharacters(result.stdout)).toBe(`ship

Usage:
  [options]

Options:
  -h, --help  show help
  --version   show version
`)
  },
)

test.sequential(
  'should expose collection and formatting for standalone help commands',
  async () => {
    @OptionCommand({ name: 'guide' })
    class StandaloneHelp implements HelpTransform {
      transform(meta: HelpMeta, context: HelpContext): HelpMeta {
        void context
        return { ...meta, title: 'custom guide' }
      }

      @Handler()
      run(@Args() args: CommandArgs, @Inject(Context) context: Context): void {
        const helpContext = new HelpContext(args, context)
        const meta = this.transform(helpContext.createMeta(), helpContext)
        context.io.stdout.write(HelpFormatter.format(meta))
      }
    }

    @Module({ options: [StandaloneHelp] })
    class AppModule {}

    const result = await createTestingApp(AppModule).invoke(['--guide'])
    expect(result.error).toBeUndefined()
    expect(result.stdout).toContain('custom guide')
    expect(result.stdout).toContain('--guide')
  },
)
