import { RUNTIME } from '@func/contracts/net-errors'
import { createSocket } from 'node:dgram'
import type { Socket as UdpSocket } from 'node:dgram'
import { connect as connectTcp } from 'node:net'
import type { Socket } from 'node:net'
import { connect as connectTls } from 'node:tls'
import type { TLSSocket } from 'node:tls'
import type { OnDispose } from '../../di/lifecycle'
import type { Context } from '../../runtime/context'
import { ErrorScope, Exception } from '../../shared/errors'
import type {
  NetExceptionOptions,
  NetworkOperationOptions,
  TcpConnectOptions,
  TlsConnectOptions,
  UdpSocketOptions,
} from './interfaces'

type ConnectionEvent = 'connect' | 'secureConnect'
type Transport = 'tcp' | 'tls' | 'udp'

interface StreamBinding {
  context: Context
  sockets: Map<Socket, Promise<void>>
}

interface DatagramBinding {
  context: Context
  sockets: Set<ManagedDatagram>
}

interface ManagedDatagram {
  readonly closed: Promise<void>
  readonly socket: UdpSocket
  finish(): void
}

interface StreamOpenOptions<SocketType extends Socket> {
  binding: StreamBinding
  event: ConnectionEvent
  operationSignal?: AbortSignal
  timeoutMs?: number
  transport: Exclude<Transport, 'udp'>
  create(): SocketType
}

type AssertNetworkOperationOptions = (
  options: unknown,
  label: string,
) => asserts options is NetworkOperationOptions

type AssertUdpSocketOptions = (
  options: unknown,
) => asserts options is UdpSocketOptions

const tcpStates = new WeakMap<TcpClient, StreamBinding>()
const tlsStates = new WeakMap<TlsClient, StreamBinding>()
const udpStates = new WeakMap<UdpSocketFactory, DatagramBinding>()

export class NetException extends Exception<RUNTIME> {
  constructor(code: RUNTIME, options: NetExceptionOptions | string = {}) {
    const normalized = typeof options === 'string' ? { message: options } : options
    super(code, {
      ...normalized,
      name: 'NetException',
      scope: ErrorScope.RUNTIME,
    })
  }
}

export class TcpClient implements OnDispose {
  connect(options: TcpConnectOptions): Promise<Socket> {
    const state = streamState(tcpStates, this, 'TcpClient')
    assertOperationOptions(options, 'TCP')
    const { signal, timeoutMs, ...connectionOptions } = options
    return openStream({
      binding: state,
      create: () => connectTcp(connectionOptions),
      event: 'connect',
      operationSignal: signal,
      timeoutMs,
      transport: 'tcp',
    })
  }

  onDispose(): Promise<void> {
    return disposeStreams(tcpStates.get(this))
  }
}

export class TlsClient implements OnDispose {
  connect(options: TlsConnectOptions): Promise<TLSSocket> {
    const state = streamState(tlsStates, this, 'TlsClient')
    assertOperationOptions(options, 'TLS')
    const { signal, timeoutMs, ...connectionOptions } = options
    return openStream({
      binding: state,
      create: () => connectTls(connectionOptions),
      event: 'secureConnect',
      operationSignal: signal,
      timeoutMs,
      transport: 'tls',
    })
  }

  onDispose(): Promise<void> {
    return disposeStreams(tlsStates.get(this))
  }
}

export class UdpSocketFactory implements OnDispose {
  open(options: UdpSocketOptions = {}): UdpSocket {
    const state = datagramState(this)
    assertUdpOptions(options)
    const { signal: operationSignal, type = 'udp4', ...socketOptions } = options
    const signal = effectiveSignal(state.context.signal, operationSignal)
    if (signal.aborted) throw abortedSocket('udp')

    try {
      const socket = createSocket({ ...socketOptions, signal, type })
      trackDatagram(state, socket)
      return socket
    } catch (error) {
      throw invalidSocketOptions('udp', error)
    }
  }

  onDispose(): Promise<void> {
    return disposeDatagrams(udpStates.get(this))
  }
}

export const bindTcpClient = (instance: TcpClient, context: Context): TcpClient => {
  tcpStates.set(instance, streamBinding(context))
  return instance
}

export const bindTlsClient = (instance: TlsClient, context: Context): TlsClient => {
  tlsStates.set(instance, streamBinding(context))
  return instance
}

export const bindUdpSocketFactory = (
  instance: UdpSocketFactory,
  context: Context,
): UdpSocketFactory => {
  udpStates.set(instance, {
    context,
    sockets: new Set(),
  })
  return instance
}

const streamBinding = (context: Context): StreamBinding => ({
  context,
  sockets: new Map(),
})

const openStream = async <SocketType extends Socket>(
  options: StreamOpenOptions<SocketType>,
): Promise<SocketType> => {
  const { binding, create, event, operationSignal, timeoutMs, transport } = options
  const signal = effectiveSignal(binding.context.signal, operationSignal)
  if (signal.aborted) throw abortedSocket(transport)
  let socket: SocketType

  try {
    socket = create()
  } catch (error) {
    throw invalidSocketOptions(transport, error)
  }

  trackStream(binding, socket, signal)
  return waitForConnection(socket, transport, event, signal, timeoutMs)
}

const waitForConnection = <SocketType extends Socket>(
  socket: SocketType,
  transport: Exclude<Transport, 'udp'>,
  event: ConnectionEvent,
  signal: AbortSignal,
  timeoutMs: number | undefined,
): Promise<SocketType> =>
  new Promise((resolve, reject) => {
    let settled = false
    const timeout = timeoutMs
      ? setTimeout(() => {
          fail(
            new NetException(RUNTIME.TIMEOUT, {
              details: { timeoutMs, transport },
              message: `${transport.toUpperCase()} connection timed out after ${timeoutMs}ms.`,
            }),
          )
        }, timeoutMs)
      : undefined
    timeout?.unref()

    const cleanup = () => {
      socket.removeListener(event, connected)
      socket.removeListener('close', closedBeforeConnect)
      socket.removeListener('error', failed)
      signal.removeEventListener('abort', aborted)
      if (timeout) clearTimeout(timeout)
    }
    const succeed = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve(socket)
    }
    const fail = (error: NetException) => {
      if (settled) return
      settled = true
      cleanup()
      socket.destroy()
      reject(error)
    }
    const connected = () => succeed()
    const failed = (cause: Error) => {
      fail(
        new NetException(RUNTIME.CONNECT, {
          cause,
          details: { transport },
          message: cause.message,
        }),
      )
    }
    const aborted = () => fail(abortedSocket(transport))
    const closedBeforeConnect = () => {
      fail(
        new NetException(RUNTIME.CONNECT, {
          details: { transport },
          message: `${transport.toUpperCase()} connection closed before it was established.`,
        }),
      )
    }
    socket.once(event, connected)
    socket.once('close', closedBeforeConnect)
    socket.once('error', failed)
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) aborted()
  })

const trackStream = (
  binding: StreamBinding,
  socket: Socket,
  signal: AbortSignal,
) => {
  const aborted = () => socket.destroy()
  const closed = new Promise<void>(resolve => {
    socket.once('close', () => {
      signal.removeEventListener('abort', aborted)
      binding.sockets.delete(socket)
      resolve()
    })
  })
  binding.sockets.set(socket, closed)
  signal.addEventListener('abort', aborted, { once: true })
}

const disposeStreams = async (binding?: StreamBinding): Promise<void> => {
  if (!binding) return
  const sockets = Array.from(binding.sockets.entries())
  sockets.forEach(([socket]) => socket.destroy())
  await Promise.all(sockets.map(([, closed]) => closed))
  binding.sockets.clear()
}

const trackDatagram = (binding: DatagramBinding, socket: UdpSocket) => {
  let finish = () => {}
  const closed = new Promise<void>(resolve => {
    finish = () => {
      binding.sockets.delete(managed)
      resolve()
    }
  })
  const managed: ManagedDatagram = { closed, finish, socket }
  binding.sockets.add(managed)
  socket.once('close', finish)
}

const disposeDatagrams = async (binding?: DatagramBinding): Promise<void> => {
  if (!binding) return
  const sockets = Array.from(binding.sockets)
  sockets.forEach(managed => {
    try {
      managed.socket.close()
    } catch (error) {
      if (!isDatagramNotRunning(error)) throw error
      managed.finish()
    }
  })
  await Promise.all(sockets.map(managed => managed.closed))
  binding.sockets.clear()
}

const effectiveSignal = (
  contextSignal: AbortSignal,
  operationSignal?: AbortSignal,
): AbortSignal =>
  operationSignal ? AbortSignal.any([contextSignal, operationSignal]) : contextSignal

const assertOperationOptions: AssertNetworkOperationOptions = (options, label) => {
  if (!options || typeof options !== 'object') {
    throw new NetException(
      RUNTIME.INVALID_OPTIONS,
      `${label} connection options must be an object.`,
    )
  }
  const timeoutMs = readProperty(options, 'timeoutMs')
  if (
    timeoutMs === undefined ||
    (Number.isSafeInteger(timeoutMs) &&
      typeof timeoutMs === 'number' &&
      timeoutMs > 0)
  ) {
    return
  }

  throw new NetException(RUNTIME.INVALID_OPTIONS, {
    details: { option: 'timeoutMs', value: timeoutMs },
    message: `${label} timeoutMs must be a positive safe integer.`,
  })
}

const assertUdpOptions: AssertUdpSocketOptions = options => {
  if (options && typeof options === 'object') return
  throw new NetException(
    RUNTIME.INVALID_OPTIONS,
    'UDP socket options must be an object.',
  )
}

const invalidSocketOptions = (
  transport: Transport,
  error: unknown,
): NetException => {
  const cause = error instanceof Error ? error : undefined
  return new NetException(RUNTIME.INVALID_OPTIONS, {
    cause,
    details: { transport },
    message: cause?.message ?? `${transport.toUpperCase()} options are invalid.`,
  })
}

const abortedSocket = (transport: Transport): NetException =>
  new NetException(RUNTIME.ABORTED, {
    details: { transport },
    message: `${transport.toUpperCase()} operation was aborted.`,
  })

const streamState = <Client extends object>(
  states: WeakMap<Client, StreamBinding>,
  instance: Client,
  clientName: string,
): StreamBinding => {
  const state = states.get(instance)
  if (state) return state
  throw new NetException(
    RUNTIME.NOT_REGISTERED,
    `${clientName} must be provided by NetModule.`,
  )
}

const datagramState = (instance: UdpSocketFactory): DatagramBinding => {
  const state = udpStates.get(instance)
  if (state) return state
  throw new NetException(
    RUNTIME.NOT_REGISTERED,
    'UdpSocketFactory must be provided by NetModule.',
  )
}

const isDatagramNotRunning = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  error.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING'

const readProperty = (value: object, key: PropertyKey): unknown =>
  Reflect.get(value, key)
