import { Module } from '../../application/definition'
import { Context } from '../../runtime/context'
import { HttpClient, bindHttpClient } from './runtime'

@Module({
  exports: [HttpClient],
  providers: [
    {
      inject: [Context],
      provide: HttpClient,
      useFactory: (context: Context) => bindHttpClient(new HttpClient(), context),
    },
  ],
})
export class HttpModule {}
