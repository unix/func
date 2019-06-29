import { Mutation } from './mutation'
import { CommandClass, OptionClass } from '../interfaces'
import { metadata, handlers } from '../constants/metadata'

export type ContainerParams = Array<CommandClass | OptionClass>
export interface ContainerData {
  [key: string]: CommandClass[]
}

export class Container {
  mutation: Mutation
  datas: ContainerData = {}
  
  constructor(
    private params: ContainerParams,
  ) {
    this.mutation = new Mutation()
    this.init()
    this.insert()
  }
  
  private init(): void {
    this.params.forEach(handler => {
      const type = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, handler)
      this.datas[type] = (this.datas[type] || []).concat([handler])
    })
  }
  
  private insert(): void {
    this.mutation.devour({
      commands: this.datas[handlers.COMMAND] || [],
      options: this.datas[handlers.OPTION] || [],
      missing: this.datas[handlers.MISSING] || [],
      majors: this.datas[handlers.MAJOR] || [],
    })
  }
}
