import type { SocketOptions as NodeUdpSocketOptions } from 'node:dgram'
import type { SocketType } from 'node:dgram'
import type { IpcNetConnectOpts, TcpNetConnectOpts } from 'node:net'
import type { ConnectionOptions as NodeTlsConnectOptions } from 'node:tls'
import type { ExceptionOptions } from '../../shared/errors'

export interface NetworkOperationOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export type TcpConnectOptions =
  | (Omit<TcpNetConnectOpts, 'signal' | 'timeout'> & NetworkOperationOptions)
  | (Omit<IpcNetConnectOpts, 'signal' | 'timeout'> & NetworkOperationOptions)

export type TlsConnectOptions = Omit<NodeTlsConnectOptions, 'timeout'> &
  NetworkOperationOptions

export interface UdpSocketOptions extends Omit<
  NodeUdpSocketOptions,
  'signal' | 'type'
> {
  signal?: AbortSignal
  type?: SocketType
}

export type NetExceptionOptions = Omit<ExceptionOptions, 'name' | 'scope'>
