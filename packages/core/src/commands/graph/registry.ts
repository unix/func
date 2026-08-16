import type { CompiledModule } from '../../di/module-compiler'
import type { Type } from '../../di/types'
import type { CommandParams, HandlerParams } from '../types'
import type { CompiledFieldOption } from '../../options/field-metadata'
import { handlers } from '../metadata'

export interface HandlerRecord {
  command?: CommandParams
  fieldOptions: CompiledFieldOption[]
  handler: Type
  kind?: handlers
  methodHandlers: HandlerParams[]
  owner: CompiledModule
}

type HandlerData = Partial<Record<handlers, HandlerRecord[]>>

export class HandlerRegistry {
  readonly invalidHandlers: HandlerRecord[] = []
  private readonly data: HandlerData = {}

  constructor(records: HandlerRecord[]) {
    records.forEach(record => {
      if (!record.kind) {
        this.invalidHandlers.push(record)
        return
      }

      this.data[record.kind] = (this.data[record.kind] ?? []).concat([record])
    })
  }

  commands(): HandlerRecord[] {
    return this.records(handlers.COMMAND)
  }

  majors(): HandlerRecord[] {
    return this.records(handlers.MAJOR)
  }

  missing(): HandlerRecord[] {
    return this.records(handlers.MISSING)
  }

  private records(kind: handlers): HandlerRecord[] {
    return this.data[kind] ?? []
  }
}
