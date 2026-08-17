import { Module } from '../../application/definition'
import { Context } from '../../runtime/context'
import {
  TcpClient,
  TlsClient,
  UdpSocketFactory,
  bindTcpClient,
  bindTlsClient,
  bindUdpSocketFactory,
} from './runtime'

@Module({
  exports: [TcpClient, TlsClient, UdpSocketFactory],
  providers: [
    {
      inject: [Context],
      provide: TcpClient,
      useFactory: (context: Context) => bindTcpClient(new TcpClient(), context),
    },
    {
      inject: [Context],
      provide: TlsClient,
      useFactory: (context: Context) => bindTlsClient(new TlsClient(), context),
    },
    {
      inject: [Context],
      provide: UdpSocketFactory,
      useFactory: (context: Context) =>
        bindUdpSocketFactory(new UdpSocketFactory(), context),
    },
  ],
})
export class NetModule {}
