import { Module } from 'func'
import { CreateNamedProjectCommand, CreateProjectCommand } from './create.command'
import { CreateService } from './create.service'

@Module({
  commands: [CreateProjectCommand, CreateNamedProjectCommand],
  providers: [CreateService],
})
export class CreateModule {}
