import { once } from 'node:events'
import { Socket, createServer } from 'node:net'
import type { AddressInfo, Server } from 'node:net'
import {
  CommandMajor,
  Context,
  ErrorScope,
  Handler,
  Injectable,
  Module,
  formatExceptionCode,
} from '../src'
import {
  NET_RUNTIME,
  NetModule,
  TcpClient,
  TlsClient,
  UdpSocketFactory,
} from '../src/subpath/net'
import { bindTcpClient, bindUdpSocketFactory } from '../src/subpath/net/runtime'
import { createNetMock } from '../src/subpath/net/testing'
import { createTestingApp } from '../src/subpath/testing'
import { expect, test } from './_test'

test.sequential(
  'should use TcpClient from a class-first protocol module',
  async () => {
    const server = createServer(socket => {
      socket.once('data', data => socket.end(data.toString().toUpperCase()))
    })
    const port = await listen(server)

    try {
      @Injectable()
      class EchoProtocol {
        constructor(private readonly tcp: TcpClient) {}

        async exchange(message: string): Promise<string> {
          const socket = await this.tcp.connect({
            host: '127.0.0.1',
            port,
          })
          const received = new Promise<string>((resolve, reject) => {
            socket.once('data', data => resolve(data.toString()))
            socket.once('error', reject)
          })
          socket.end(message)
          return received
        }
      }

      @Module({
        exports: [EchoProtocol],
        imports: [NetModule],
        providers: [EchoProtocol],
      })
      class EchoModule {}

      @CommandMajor()
      class Major {
        constructor(private readonly echo: EchoProtocol) {}

        @Handler()
        run() {
          return this.echo.exchange('hello')
        }
      }

      @Module({ commands: [Major], imports: [EchoModule] })
      class AppModule {}

      const invocation = await createTestingApp(AppModule).invoke()
      expect(invocation.error).toBeUndefined()
      expect(invocation.result).toBe('HELLO')
    } finally {
      await close(server)
    }
  },
)

test.sequential('should dispose open TCP and UDP sockets', async () => {
  const server = createServer()
  const port = await listen(server)

  try {
    const tcp = boundTcpClient()
    const socket = await tcp.connect({ host: '127.0.0.1', port })
    const tcpClosed = once(socket, 'close')
    await tcp.onDispose()
    await tcpClosed
    expect(socket.destroyed).toBe(true)
    const udp = boundUdpSocketFactory()
    const datagram = udp.open()
    datagram.bind(0, '127.0.0.1')
    await once(datagram, 'listening')
    const udpClosed = once(datagram, 'close')
    await udp.onDispose()
    await udpClosed
  } finally {
    await close(server)
  }
})

test('should enforce NetModule registration, abort, and options', async () => {
  expect(() => new TcpClient().connect({ port: 80 })).toThrow(
    expect.objectContaining({
      code: netRuntimeErrorCode(NET_RUNTIME.NOT_REGISTERED),
    }),
  )
  expect(() => new TlsClient().connect({ port: 443 })).toThrow(
    expect.objectContaining({
      code: netRuntimeErrorCode(NET_RUNTIME.NOT_REGISTERED),
    }),
  )
  expect(() => new UdpSocketFactory().open()).toThrow(
    expect.objectContaining({
      code: netRuntimeErrorCode(NET_RUNTIME.NOT_REGISTERED),
    }),
  )

  const controller = new AbortController()
  controller.abort()
  await expect(
    boundTcpClient(controller.signal).connect({ port: 80 }),
  ).rejects.toMatchObject({
    code: netRuntimeErrorCode(NET_RUNTIME.ABORTED),
  })
  expect(() => boundTcpClient().connect({ port: 80, timeoutMs: 0 })).toThrow(
    expect.objectContaining({
      code: netRuntimeErrorCode(NET_RUNTIME.INVALID_OPTIONS),
      details: { option: 'timeoutMs', value: 0 },
    }),
  )
})

test('should override network clients with a strict net mock', async () => {
  const net = createNetMock()
  const socket = new Socket()
  net.expectTcp({ host: 'cache.internal', port: 6379 }).reply(socket)

  @Injectable()
  class CacheProtocol {
    constructor(private readonly tcp: TcpClient) {}

    connect() {
      return this.tcp.connect({ host: 'cache.internal', port: 6379 })
    }
  }

  @CommandMajor()
  class Major {
    constructor(private readonly cache: CacheProtocol) {}

    @Handler()
    async run() {
      return (await this.cache.connect()) === socket
    }
  }

  @Module({
    commands: [Major],
    imports: [NetModule],
    providers: [CacheProtocol],
  })
  class AppModule {}

  try {
    const invocation = await createTestingApp(AppModule, {
      overrides: net.overrides(),
    }).invoke()
    expect(invocation.error).toBeUndefined()
    expect(invocation.result).toBe(true)
    expect(net.calls).toEqual([
      {
        options: { host: 'cache.internal', port: 6379 },
        transport: 'tcp',
      },
    ])
    expect(() => net.verify()).not.toThrow()
  } finally {
    socket.destroy()
  }
})

const boundTcpClient = (signal = new AbortController().signal): TcpClient =>
  bindTcpClient(new TcpClient(), context(signal))

const boundUdpSocketFactory = (
  signal = new AbortController().signal,
): UdpSocketFactory => bindUdpSocketFactory(new UdpSocketFactory(), context(signal))

const context = (signal: AbortSignal): Context =>
  new Context(
    [],
    {
      stderr: process.stderr,
      stdin: process.stdin,
      stdout: process.stdout,
    },
    process.cwd(),
    signal,
  )

const listen = async (server: Server): Promise<number> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!isAddressInfo(address)) {
    throw new TypeError('Expected a TCP server address.')
  }
  return address.port
}

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

const netRuntimeErrorCode = (code: NET_RUNTIME) =>
  formatExceptionCode(ErrorScope.RUNTIME, code)

const isAddressInfo = (value: unknown): value is AddressInfo =>
  typeof value === 'object' &&
  value !== null &&
  'port' in value &&
  typeof value.port === 'number'
