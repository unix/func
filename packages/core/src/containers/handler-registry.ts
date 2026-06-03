import type { CommandClass } from '../interfaces'
import { handlers, metadata } from '../utils/metadata'
import type { ContainerData, ContainerParams } from './container'

export class HandlerRegistry {
  datas: ContainerData = {}
  invalidHandlers: ContainerParams = []

  constructor(params: ContainerParams) {
    params.forEach(handler => {
      const type = Reflect.getMetadata(metadata.HANDLER_IDENTIFIER, handler)
      if (!type) {
        this.invalidHandlers = this.invalidHandlers.concat([handler])
        return
      }

      this.datas[type] = (this.datas[type] || []).concat([handler])
    })
  }

  commands(): ContainerParams {
    return this.handlers(handlers.COMMAND)
  }

  errors(): ContainerParams {
    return this.handlers(handlers.ERROR)
  }

  major(): CommandClass | undefined {
    return this.majors()[0]
  }

  majors(): ContainerParams {
    return this.handlers(handlers.MAJOR)
  }

  missing(): ContainerParams {
    return this.handlers(handlers.MISSING)
  }

  findCommand(input?: string): CommandClass | undefined {
    if (!input || input.startsWith('-')) return undefined

    return this.commands().find(item => {
      const data = Reflect.getMetadata(metadata.COMMAND_IDENTIFIER, item)
      if (!data) return false

      return data.name === input || data.alias === input
    })
  }

  private handlers(kind: handlers): ContainerParams {
    return this.datas[kind] || []
  }
}
