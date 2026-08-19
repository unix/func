import fs from 'fs'
import os from 'os'
import path from 'path'
import { beforeEach, expect, test, vi } from 'vitest'
import { buildWithRolldown } from '../src/actions/build'
import { dev } from '../src/actions/dev'
import { run } from '../src/utils/command'
import {
  commitDevBundle,
  discardDevBundle,
  prepareDevBundle,
} from '../src/utils/dev-cache'
import { cwd } from '../src/utils/paths'

vi.mock('../src/actions/build', () => ({
  buildWithRolldown: vi.fn(),
}))

vi.mock('../src/utils/command', () => ({
  isCommandFailureError: () => false,
  run: vi.fn(),
}))

vi.mock('../src/utils/dev-cache', () => ({
  commitDevBundle: vi.fn(),
  discardDevBundle: vi.fn(),
  prepareDevBundle: vi.fn(),
}))

vi.mock('../src/utils/dev-error-handler-path', () => ({
  resolveDevErrorHandler: () => '/test/dev-error-handler.js',
}))

const buildMock = vi.mocked(buildWithRolldown)
const commitMock = vi.mocked(commitDevBundle)
const discardMock = vi.mocked(discardDevBundle)
const prepareMock = vi.mocked(prepareDevBundle)
const runMock = vi.mocked(run)

beforeEach(() => {
  vi.clearAllMocks()
  prepareMock.mockImplementation(options => testBundle(options.entry, false))
})

test('dev should bundle an ESM application before running it', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'funcgo-dev-test-'))
  const entry = path.join(directory, 'index.ts')
  fs.writeFileSync(entry, "import 'func'\n")
  buildMock.mockResolvedValue({ files: [entry] })

  try {
    await dev({ file: entry, userArgs: ['status', '--json'] })
    const options = buildMock.mock.calls[0][0]
    expect(options).toMatchObject({
      entry,
      external: [],
      minify: false,
      report: false,
      sourcemap: 'inline',
    })
    expect(options.output).toBe('/test/cache/bundles/bundle-current')
    expect(commitMock).toHaveBeenCalledWith(
      expect.objectContaining({ hit: false, output: options.output }),
      [entry],
    )
    expect(runMock).toHaveBeenCalledWith(
      process.execPath,
      [
        '--enable-source-maps',
        '-r',
        '/test/dev-error-handler.js',
        '/test/cache/bundles/bundle-current/index.js',
        'status',
        '--json',
      ],
      {
        cwd,
        env: {
          ...process.env,
          NODE_COMPILE_CACHE:
            process.env.NODE_COMPILE_CACHE ?? '/test/cache/node-compile-cache',
        },
        shell: false,
        silentFailure: true,
      },
    )
    expect(discardMock).not.toHaveBeenCalled()
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test('dev should reuse a valid persistent bundle', async () => {
  const entry = path.resolve('cached-entry.ts')
  prepareMock.mockReturnValue(testBundle(entry, true))
  await dev({ file: entry, userArgs: ['status'] })
  expect(buildMock).not.toHaveBeenCalled()
  expect(commitMock).not.toHaveBeenCalled()
  expect(runMock).toHaveBeenCalledOnce()
  expect(discardMock).not.toHaveBeenCalled()
})

const testBundle = (
  entry: string,
  hit: boolean,
): ReturnType<typeof prepareDevBundle> => ({
  cacheDirectory: '/test/cache',
  compileCache: '/test/cache/node-compile-cache',
  cwd,
  entry,
  file: '/test/cache/bundles/bundle-current/index.js',
  generation: 'bundle-current',
  hit,
  output: '/test/cache/bundles/bundle-current',
  signature: 'test-signature',
})
