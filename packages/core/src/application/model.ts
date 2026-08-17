import type { CommandGraph } from '../commands/graph/compiler'
import type { CompiledGraph } from '../di/module-compiler'

export interface CompiledApplication {
  readonly appName?: string
  commandGraph: CommandGraph
  graph: CompiledGraph
}
