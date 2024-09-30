export interface GraphNode {
  id: number
  position: { x: number, y: number }
  connectedNodes: Set<GraphNode>
}

export type DirectionType = 'one-way' | 'both-ways' | 'undirected'

export interface Edge {
  id: string
  from: GraphNode
  to: GraphNode
  weight: number
  directionType: DirectionType
}