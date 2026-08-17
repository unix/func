import { Socket as UdpSocket } from 'node:dgram'
import { Socket } from 'node:net'
import { TLSSocket } from 'node:tls'
import type { ProviderOverride } from '../../testing/provider-overrides'
import type {
  TcpConnectOptions,
  TlsConnectOptions,
  UdpSocketOptions,
} from '../interfaces'
import { TcpClient, TlsClient, UdpSocketFactory } from '../runtime'

export type NetMockTransport = 'tcp' | 'tls' | 'udp'

export type NetMockCall =
  | {
      readonly options: TcpConnectOptions
      readonly transport: 'tcp'
    }
  | {
      readonly options: TlsConnectOptions
      readonly transport: 'tls'
    }
  | {
      readonly options: UdpSocketOptions
      readonly transport: 'udp'
    }

export interface NetMockExpectation<SocketType> {
  reject(error: Error): void
  reply(socket: SocketType): void
}

export interface NetMock {
  readonly calls: readonly NetMockCall[]
  expectTcp(options: TcpConnectOptions): NetMockExpectation<Socket>
  expectTls(options: TlsConnectOptions): NetMockExpectation<TLSSocket>
  expectUdp(options?: UdpSocketOptions): NetMockExpectation<UdpSocket>
  overrides(): ProviderOverride[]
  verify(): void
}

interface ExpectedNetOperation {
  readonly options: object
  outcome?: NetMockOutcome
  readonly transport: NetMockTransport
}

type NetMockOutcome =
  | { readonly error: Error; readonly type: 'reject' }
  | { readonly socket: Socket | TLSSocket | UdpSocket; readonly type: 'reply' }

interface NetMockConsumer {
  consume(call: NetMockCall): NetMockOutcome
}

class MockTcpClient extends TcpClient {
  constructor(private readonly controller: NetMockConsumer) {
    super()
  }

  override async connect(options: TcpConnectOptions): Promise<Socket> {
    const outcome = this.controller.consume(tcpCall(options))
    if (outcome.type === 'reject') throw outcome.error
    if (outcome.socket instanceof Socket) return outcome.socket
    throw invalidMockSocket('TCP')
  }

  override async onDispose(): Promise<void> {}
}

class MockTlsClient extends TlsClient {
  constructor(private readonly controller: NetMockConsumer) {
    super()
  }

  override async connect(options: TlsConnectOptions): Promise<TLSSocket> {
    const outcome = this.controller.consume(tlsCall(options))
    if (outcome.type === 'reject') throw outcome.error
    if (outcome.socket instanceof TLSSocket) return outcome.socket
    throw invalidMockSocket('TLS')
  }

  override async onDispose(): Promise<void> {}
}

class MockUdpSocketFactory extends UdpSocketFactory {
  constructor(private readonly controller: NetMockConsumer) {
    super()
  }

  override open(options: UdpSocketOptions = {}): UdpSocket {
    const outcome = this.controller.consume(udpCall(options))
    if (outcome.type === 'reject') throw outcome.error
    if (outcome.socket instanceof UdpSocket) return outcome.socket
    throw invalidMockSocket('UDP')
  }

  override async onDispose(): Promise<void> {}
}

class NetMockController implements NetMock, NetMockConsumer {
  private readonly recordedCalls: NetMockCall[] = []
  private readonly expectations: ExpectedNetOperation[] = []

  get calls(): readonly NetMockCall[] {
    return Object.freeze(this.recordedCalls.slice())
  }

  expectTcp(options: TcpConnectOptions): NetMockExpectation<Socket> {
    return this.expect('tcp', options)
  }

  expectTls(options: TlsConnectOptions): NetMockExpectation<TLSSocket> {
    return this.expect('tls', options)
  }

  expectUdp(options: UdpSocketOptions = {}): NetMockExpectation<UdpSocket> {
    return this.expect('udp', options)
  }

  overrides(): ProviderOverride[] {
    return [
      {
        provide: TcpClient,
        useFactory: () => new MockTcpClient(this),
      },
      {
        provide: TlsClient,
        useFactory: () => new MockTlsClient(this),
      },
      {
        provide: UdpSocketFactory,
        useFactory: () => new MockUdpSocketFactory(this),
      },
    ]
  }

  verify(): void {
    if (!this.expectations.length) return
    const next = this.expectations[0]
    throw new Error(
      `Expected ${this.expectations.length} more network operation(s); next was ${next.transport.toUpperCase()}.`,
    )
  }

  consume(call: NetMockCall): NetMockOutcome {
    this.recordedCalls.push(call)
    const expected = this.expectations.at(0)
    if (!expected) {
      throw new Error(
        `Unexpected network operation: ${call.transport.toUpperCase()}.`,
      )
    }
    if (!matches(expected, call)) {
      throw new Error(
        `Unexpected network operation: received ${call.transport.toUpperCase()}, expected ${expected.transport.toUpperCase()}.`,
      )
    }
    if (!expected.outcome) {
      throw new Error(
        `Network expectation ${expected.transport.toUpperCase()} does not have a reply or rejection.`,
      )
    }

    this.expectations.shift()
    return expected.outcome
  }

  private expect<SocketType extends Socket | TLSSocket | UdpSocket>(
    transport: NetMockTransport,
    options: object,
  ): NetMockExpectation<SocketType> {
    assertOptions(options)
    const expected: ExpectedNetOperation = {
      options: Object.freeze({ ...options }),
      transport,
    }
    this.expectations.push(expected)

    return {
      reject: error => {
        if (!(error instanceof Error)) {
          throw new TypeError('Network mock rejection must be an Error.')
        }
        setOutcome(expected, { error, type: 'reject' })
      },
      reply: socket => {
        assertSocket(socket)
        setOutcome(expected, { socket, type: 'reply' })
      },
    }
  }
}

export const createNetMock = (): NetMock => new NetMockController()

const tcpCall = (
  options: TcpConnectOptions,
): Extract<NetMockCall, { transport: 'tcp' }> =>
  Object.freeze({
    options: Object.freeze({ ...options }),
    transport: 'tcp',
  })

const tlsCall = (
  options: TlsConnectOptions,
): Extract<NetMockCall, { transport: 'tls' }> =>
  Object.freeze({
    options: Object.freeze({ ...options }),
    transport: 'tls',
  })

const udpCall = (
  options: UdpSocketOptions,
): Extract<NetMockCall, { transport: 'udp' }> =>
  Object.freeze({
    options: Object.freeze({ ...options }),
    transport: 'udp',
  })

const matches = (expected: ExpectedNetOperation, actual: NetMockCall): boolean =>
  expected.transport === actual.transport &&
  shallowEqual(expected.options, actual.options)

const shallowEqual = (expected: object, actual: object): boolean => {
  const expectedEntries = Object.entries(expected)
  const actualEntries = Object.entries(actual)
  if (expectedEntries.length !== actualEntries.length) return false
  return expectedEntries.every(([key, value]) => Reflect.get(actual, key) === value)
}

const setOutcome = (expected: ExpectedNetOperation, outcome: NetMockOutcome) => {
  if (expected.outcome) {
    throw new Error(
      `Network expectation ${expected.transport.toUpperCase()} already has an outcome.`,
    )
  }
  expected.outcome = outcome
}

const assertOptions = (options: unknown) => {
  if (options && typeof options === 'object') return
  throw new TypeError('Network mock options must be an object.')
}

const assertSocket = (socket: unknown) => {
  if (socket && typeof socket === 'object') return
  throw new TypeError('Network mock reply must be a socket object.')
}

const invalidMockSocket = (transport: string): Error =>
  new TypeError(`Network mock ${transport} reply has an incompatible socket.`)
