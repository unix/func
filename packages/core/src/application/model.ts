import type { CommandGraph } from '../commands/graph/runtime'
import type { CompiledGraph } from '../di/module-graph'

export interface CompiledApplication {
  readonly appName?: string
  commandGraph: CommandGraph
  graph: CompiledGraph
}
