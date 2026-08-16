import type { CommandGraph } from '../commands/graph/compiler'
import type { CompiledGraph } from '../di/module-compiler'

export interface CompiledApplication {
  commandGraph: CommandGraph
  graph: CompiledGraph
}
