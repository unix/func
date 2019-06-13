import { Mutation } from './mutation'
import { CommandClass, OptionClass } from '../interfaces'
import { metadata, handlers } from '../constants/metadata'

export interface CommandFunctionMap {
  [key: string]: CommandClass
}

export interface OptionFunctionMap {
  [key: string]: OptionClass
}

export type ContainerParams = Array<CommandClass | OptionClass>

export interface ContainerData {
  [handlers.COMMAND]: CommandClass[]
  [handlers.OPTION]: OptionClass[]
  [handlers.NOT_FOUND]: CommandClass[]
  [handlers.MAJOR]: CommandClass[]
}

export class Container {
  
  mutation: Mutation
  datas: ContainerData = {
    [handlers.COMMAND]: [],
    [handlers.OPTION]: [],
    [handlers.NOT_FOUND]: [],
    [handlers.MAJOR]: [],
  }
  
  constructor(
    private params: ContainerParams,
  ) {
    this.mutation = new Mutation()
    this.init()
    this.insert()
  }
  
  getCommands(): CommandClass[] {
    return this.datas[handlers.COMMAND]
      .map(fn => Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, fn))
  }
  
  private init(): void {
    this.params.forEach(handler => {
      const type = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, handler)
      const dataColumn = this.datas[type]
      dataColumn && dataColumn.push(handler)
    })
  }
  
  private insert(): void {
    this.mutation.devour({
      commands: this.datas[handlers.COMMAND],
      options: this.datas[handlers.OPTION],
      notFounds: this.datas[handlers.NOT_FOUND],
      majors: this.datas[handlers.MAJOR],
    })
  }
}
