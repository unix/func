import { Module } from 'func'
import { OutputService } from './services/output.service'

@Module({
  exports: [OutputService],
  providers: [OutputService],
})
export class SharedModule {}
