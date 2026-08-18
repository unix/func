import { Command, Flag, Handler, Injectable, Module, Option, Stdout } from '../src'
import type { Writable } from 'node:stream'
import { Writable as WritableStream } from 'node:stream'
import { compileApplication } from '../src/application/compiler'
import { invokeApplication } from '../src/application/invocation'
import { hydrateApplicationPlan } from '../src/subpath/precompiled/hydrate'
import { applicationPlan } from '../src/subpath/precompiler/serialize'
import { expect, test } from 'vitest'

@Option()
class BuildOptions {
  @Flag()
  verbose = false
}

@Injectable()
class Formatter {
  format(verbose: boolean): string {
    return verbose ? 'built verbosely' : 'built'
  }
}

@Command({ alias: 'b', path: 'build' })
class BuildCommand {
  constructor(
    private readonly formatter: Formatter,
    private readonly options: BuildOptions,
  ) {}

  @Handler()
  run(@Stdout() stdout: Writable) {
    stdout.write(`${this.formatter.format(this.options.verbose)}\n`)
  }
}

@Module({
  commands: [BuildCommand],
  options: [BuildOptions],
  providers: [Formatter],
})
class AppModule {}

test('hydrates a runtime-equivalent application from a precompiled plan', async () => {
  const source = compileApplication(AppModule, { appName: 'precompiled-test' })
  const hydrated = hydrateApplicationPlan(
    applicationPlan(source),
    'precompiled-test',
  )

  expect(hydrated.appName).toBe(source.appName)
  expect(hydrated.commandGraph.commands()).toEqual(source.commandGraph.commands())
  expect(hydrated.commandGraph.match(['b'])?.node.path).toEqual(['build'])
  expect(hydrated.graph.root.options[0]).toBe(
    hydrated.graph.root.providers.get(BuildOptions),
  )

  const normalOutput = outputBuffer()
  const precompiledOutput = outputBuffer()
  const normal = await invokeApplication(source, ['build', '--verbose'], {
    stdout: normalOutput.stream,
  })
  const precompiled = await invokeApplication(hydrated, ['build', '--verbose'], {
    stdout: precompiledOutput.stream,
  })

  expect(precompiled).toEqual(normal)
  expect(precompiledOutput.value()).toBe(normalOutput.value())
  expect(precompiledOutput.value()).toBe('built verbosely\n')
})

test('rejects an incompatible precompiled ABI before bootstrap', () => {
  expect(() => hydrateApplicationPlan({ abi: 2 })).toThrow(
    'Unsupported func precompiled application ABI: 2.',
  )
})

const outputBuffer = (): { stream: WritableStream; value: () => string } => {
  const chunks: string[] = []
  return {
    stream: new WritableStream({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk))
        callback()
      },
    }),
    value: () => chunks.join(''),
  }
}
