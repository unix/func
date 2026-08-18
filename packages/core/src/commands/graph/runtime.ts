import type { CommandInfo } from '../command-info'
import type {
  CommandMatch,
  CommandNode,
  CompiledCommandGraph,
  SpecialCommandKind,
} from './model'
import type { HandlerRecord } from './registry'

export class CommandGraph {
  private readonly commandInfos: readonly CommandInfo[]
  private readonly commandNodes: readonly CommandNode[]
  private readonly handlerRecords: readonly HandlerRecord[]
  private readonly namedCommandNodes: readonly CommandNode[]
  private readonly root: CommandNode
  private readonly specialCommandNodes: ReadonlyMap<
    SpecialCommandKind,
    readonly CommandNode[]
  >
  private readonly specialRoots: ReadonlyMap<SpecialCommandKind, CommandNode>

  constructor(graph: CompiledCommandGraph, records: readonly HandlerRecord[]) {
    this.commandInfos = graph.commandInfos
    this.commandNodes = graph.nodes
    this.namedCommandNodes = graph.nodes.filter(node => node.path.length)
    this.handlerRecords = records
    this.root = graph.root
    this.specialCommandNodes = graph.specialNodes
    this.specialRoots = graph.specialRoots
  }

  commands(): readonly CommandInfo[] {
    return this.commandInfos
  }

  nodes(): readonly CommandNode[] {
    return this.commandNodes
  }

  namedNodes(): readonly CommandNode[] {
    return this.namedCommandNodes
  }

  records(): readonly HandlerRecord[] {
    return this.handlerRecords
  }

  specialNodes(kind: SpecialCommandKind): readonly CommandNode[] {
    return this.specialCommandNodes.get(kind) ?? []
  }

  rootNode(): CommandNode {
    return this.root
  }

  specialRoot(kind: SpecialCommandKind): CommandNode | undefined {
    return this.specialRoots.get(kind)
  }

  match(argv: readonly string[]): CommandMatch | undefined {
    return this.matchFrom(this.root, argv, false)
  }

  matchSpecial(
    kind: SpecialCommandKind,
    argv: readonly string[],
  ): CommandMatch | undefined {
    const root = this.specialRoots.get(kind)
    if (!root) return undefined
    return this.matchFrom(root, argv, true)
  }

  private matchFrom(
    root: CommandNode,
    argv: readonly string[],
    allowRoot: boolean,
  ): CommandMatch | undefined {
    let node = root
    let consumed = 0

    while (consumed < argv.length) {
      const token = argv[consumed]
      if (!token || token.startsWith('-')) break
      const child = node.transitions.get(token)
      if (!child) break
      node = child
      consumed += 1
    }

    if (!allowRoot && !consumed) return undefined
    return {
      consumed,
      invokedPath: argv.slice(0, consumed),
      node,
    }
  }
}
