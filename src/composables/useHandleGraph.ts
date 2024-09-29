import { reactive, computed, ref } from 'vue'

interface GraphNode {
  id: number
  position: { x: number, y: number }
  connectedNodes: Set<GraphNode>
}

type DirectionType = 'one-way' | 'both-ways' | 'undirected'

interface Edge {
  id: string
  from: GraphNode
  to: GraphNode
  weight: number
  directionType: DirectionType
}

const useGraph = () => {
  const nodes = reactive<GraphNode[]>([])
  const edges = reactive<Edge[]>([])
  const currentId = ref(1)

  const addNode = (x: number, y: number) => {
    const id = currentId.value++
    if (!nodes.find(node => node.id === id)) {
      nodes.push({
        id,
        position: { x, y },
        connectedNodes: new Set()
      })
    }
  }

  const addEdge = (fromId: number, toId: number, directionType: DirectionType) => {
    const fromNode = nodes.find(node => node.id === fromId)
    const toNode = nodes.find(node => node.id === toId)

    if (fromNode && toNode) {
      let existingEdge = edges.find(edge => (
        (edge.from === fromNode && edge.to === toNode) ||
        (edge.from === toNode && edge.to === fromNode)
      )) // update this so `from -> to` just changes the type to directed both ways

      if (existingEdge) return
      
      if (directionType === 'both-ways' || directionType === 'undirected') {
        fromNode.connectedNodes.add(toNode)
        toNode.connectedNodes.add(fromNode)
      } else {
        fromNode.connectedNodes.add(toNode)
      }
      const newEdge: Edge = {
        id: `${fromId}-${toId}`,
        from: fromNode,
        to: toNode,
        weight: 1,
        directionType: directionType
      }

      edges.push(newEdge)
    }
    
  }

  const deleteNode = (id: string | number) => {
    const nodeIndex = nodes.findIndex(node => node.id === id)

    if (nodeIndex === -1) return

    const node = nodes[nodeIndex]

    const edgesToDelete: number[] = []

    edges.forEach((edge, edgeIndex) => {
      if (edge.from === node || edge.to === node) {
        edge.from.connectedNodes.delete(edge.to)
        edge.to.connectedNodes.delete(edge.from)

        edgesToDelete.push(edgeIndex)
      }
    })

    for (let i = edgesToDelete.length - 1; i >= 0; i--) {
      edges.splice(edgesToDelete[i], 1)
    }
    nodes.splice(nodeIndex, 1)
  }

  const deleteEdge = (fromId: number, toId: number) => {
    const edgeIndex = edges.findIndex(edge => (
      (edge.from.id === fromId && edge.to.id === toId) ||
      (edge.from.id === toId && edge.to.id === fromId)
    ))

    if (edgeIndex === -1) return

    const edge = edges[edgeIndex]

    edge.from.connectedNodes.delete(edge.to)
    edge.to.connectedNodes.delete(edge.from)

    edges.splice(edgeIndex, 1)
  }

  const updateEdgeType = (fromId: number, toId: number, newType: 'one-way' | 'both-ways' | 'undirected') => {
    const edge = edges.find(edge => (
      (edge.from.id === fromId && edge.to.id === toId) ||
      (edge.from.id === toId && edge.to.id === fromId)
    ))

    if (edge) {
      if (newType === 'one-way') {
        edge.directionType = 'one-way'
        edge.from.connectedNodes.add(edge.to)
        edge.to.connectedNodes.delete(edge.from)
      } else {
        edge.directionType = newType
        edge.from.connectedNodes.add(edge.to)
        edge.to.connectedNodes.add(edge.from)
      }
    }
  }

  const getNodes = computed(() => nodes)
  const getEdges = computed(() => edges)

  return {
    nodes: getNodes,
    edges: getEdges,
    addNode,
    addEdge,
    deleteNode,
    deleteEdge,
    updateEdgeType
  }
}


export default useGraph