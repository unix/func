import { Module } from '../../application/definition'
import { Context } from '../../runtime/context'
import { FuncProcess, bindFuncProcess } from './runtime'

@Module({
  exports: [FuncProcess],
  providers: [
    {
      inject: [Context],
      provide: FuncProcess,
      useFactory: (context: Context) => bindFuncProcess(new FuncProcess(), context),
    },
  ],
})
export class ProcessModule {}
