import { reactive, computed, ref, type Ref, type Reactive, onMounted } from 'vue'
import type { GraphNode, Edge, DirectionType } from '../utils/types.ts'
import { miniNodeRadius, nodeRadius, miniNodeOffsets } from '../utils/constants.ts'
import { checkHoverMiniNodes, distanceToLineSquared, isMouseOnNode, averageCoordsofTwoPoints } from '../utils/mouseGeometry'

type GetterOrValue<T, K extends any[] =[] > = T | ((...arg: K) => T)

type GraphOptions = Partial<{
  nodeColor: GetterOrValue<string>,
  nodeBorderColor: GetterOrValue<string>,
  nodeTextColor: GetterOrValue<string>,
  nodeTextSize: GetterOrValue<number>,
  nodeBorderWeight: GetterOrValue<number>,
  edgeWeight: GetterOrValue<number>,
  edgeColor: GetterOrValue<string>,
  edgeTextColor: GetterOrValue<string>,
  edgeTextSize: GetterOrValue<number>,
  miniNodeColor: GetterOrValue<string>,
  // 
  nodes: Reactive<GraphNode[]>
  edges: Reactive<Edge[]>
  // 
  onStructureChange: (nodes: Reactive<GraphNode[]>, edges: Reactive<Edge[]>) => void
}>

const useGraph = (canvas: Ref<HTMLCanvasElement | null>, options: GraphOptions = {}) => {

  const getValue = <T, K extends any[]>(value: GetterOrValue<T, K>, ...args: K) => {
    if (typeof value === 'function') {
      return (value as (...args: K) => T)(...args)
    }
    return value
  }

  const {
    nodeColor = '#1F2937',
    nodeBorderColor = '#121A29',
    nodeTextColor = 'white',
    nodeTextSize = 20,
    nodeBorderWeight = 10,
    edgeWeight = 10,
    edgeColor = '#121A29',
    edgeTextColor = 'white',
    edgeTextSize = 15,
    miniNodeColor = '#121A29',
    nodes = reactive<GraphNode[]>([]),
    edges = reactive<Edge[]>([]),
  } = options

  const isDragging = ref(false)
  const draggedNode = ref<GraphNode | null>(null)
  const hoveredNode = ref<GraphNode | null>(null)
  const draggingMiniNode = ref(false)
  const draggingMiniNodeData = ref<{ origin: GraphNode, mousePosition: { x: number, y: number } } | null>(null)
  const currentId = ref(1)
  const edgeOfClickedWeight = ref<Edge | null>(null)
  const edgeDistances = {
    'both-ways': 50 ** 2,
    'one-way': 10 ** 2,
    'undirected': 10 ** 2
  }

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

  const getEdgeId = (fromId: number, toId: number) => {
    return `${fromId}-${toId}`
  }

  const addEdge = (fromId: number, toId: number, directionType: DirectionType) => {
    const fromNode = nodes.find(node => node.id === fromId)
    const toNode = nodes.find(node => node.id === toId)

    if (fromNode && toNode) {
      let existingEdge = edges.find(edge => (
        (edge.from === fromNode && edge.to === toNode) ||
        (edge.from === toNode && edge.to === fromNode)
      )) // TODO: update this so `from -> to` just changes the type to directed both ways

      if (existingEdge) return
      
      if (directionType === 'both-ways' || directionType === 'undirected') {
        fromNode.connectedNodes.add(toNode)
        toNode.connectedNodes.add(fromNode)
      } else {
        fromNode.connectedNodes.add(toNode)
      }
      const newEdge: Edge = {
        id: getEdgeId(fromId, toId),
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
      getEdgeId(fromId, toId) === edge.id ||
      getEdgeId(toId, fromId) === edge.id
    ))

    if (edgeIndex === -1) return

    const edge = edges[edgeIndex]

    edge.from.connectedNodes.delete(edge.to)
    edge.to.connectedNodes.delete(edge.from)

    edges.splice(edgeIndex, 1)
  }

  const updateEdgeType = (fromId: number, toId: number, currentEdgeType: DirectionType) => {
    const edge = edges.find(edge => (
      getEdgeId(fromId, toId) === edge.id ||
      getEdgeId(toId, fromId) === edge.id
    ))

    const newType = currentEdgeType === 'undirected' ? 'one-way' : (currentEdgeType === 'one-way' ? 'both-ways' : 'undirected')

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

  const draw = () => {
    const width = canvas.value!.width
    const height = canvas.value!.height

    if (!canvas.value) return
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    if (draggingMiniNode.value) {
      drawAddNewEdgeWithMiniNode(ctx)
    }

    getEdges.value.forEach(edge => {
      drawEdge(ctx, edge)
    })

    getNodes.value.forEach(node => {
      drawNode(ctx, node)
    })

    if (hoveredNode.value && !isDragging.value) {
      drawMiniNodes(ctx, hoveredNode.value.position.x, hoveredNode.value.position.y)
    }
  }

  const drawMiniNodes = (ctx: CanvasRenderingContext2D, originX: number, originY: number) => {

    if (draggingMiniNode.value) return

    Object.values(miniNodeOffsets).forEach(miniNode => {
      ctx.beginPath()
      ctx.arc(originX + miniNode.x, originY + miniNode.y, miniNodeRadius, 0, Math.PI * 2)
      ctx.fillStyle = getValue(miniNodeColor, miniNode)
      ctx.fill()
      ctx.closePath()
    })
  }

  const drawEdge = (ctx: CanvasRenderingContext2D, edge: Edge) => {
    const drawArrow = (x: number, y: number, angle: number) => {
      const arrowOffsetX = x - nodeRadius * Math.cos(angle)
      const arrowOffsetY = y - nodeRadius * Math.sin(angle)

      ctx.beginPath()
      ctx.moveTo(arrowOffsetX, arrowOffsetY)
      ctx.lineTo(
        arrowOffsetX - 30 * Math.cos(angle - Math.PI / 6),
        arrowOffsetY - 30 * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        arrowOffsetX - 30 * Math.cos(angle + Math.PI / 6),
        arrowOffsetY - 30 * Math.sin(angle + Math.PI / 6)
      )
      ctx.lineTo(arrowOffsetX, arrowOffsetY)
      ctx.fillStyle = getValue(edgeColor, edge)
      ctx.fill()
      ctx.closePath()
    }

    if (edge.directionType === 'one-way') {
      const angle = Math.atan2(
        edge.to.position.y - edge.from.position.y,
        edge.to.position.x - edge.from.position.x
      )
      ctx.beginPath()
      ctx.moveTo(edge.from.position.x, edge.from.position.y)
      ctx.lineTo(edge.to.position.x - (nodeRadius + 10) * Math.cos(angle), edge.to.position.y - (nodeRadius + 10) * Math.sin(angle))
      ctx.strokeStyle = getValue(edgeColor, edge)
      ctx.lineWidth = getValue(edgeWeight, edge)
      ctx.stroke()
      ctx.closePath()

      drawArrow(edge.to.position.x, edge.to.position.y, angle)

      const { x, y } = averageCoordsofTwoPoints(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y)
      ctx.fillStyle = getValue(edgeTextColor, edge)
      ctx.font = `${getValue(edgeTextSize, edge)}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(`${edge.weight}`, x, y)

    } else if (edge.directionType === 'both-ways') {
      const angle = Math.atan2(
        edge.to.position.y - edge.from.position.y,
        edge.to.position.x - edge.from.position.x
      )
      const lineOffsetX = 20 * Math.cos(angle + Math.PI / 2)
      const lineOffsetY = 20 * Math.sin(angle + Math.PI / 2)

      ctx.beginPath()
      ctx.moveTo(edge.from.position.x + lineOffsetX, edge.from.position.y + lineOffsetY)
      ctx.lineTo(edge.to.position.x + lineOffsetX - (nodeRadius + 10) * Math.cos(angle), edge.to.position.y + lineOffsetY - (nodeRadius + 10) * Math.sin(angle))

      ctx.moveTo(edge.from.position.x - lineOffsetX + (nodeRadius + 10) * Math.cos(angle), edge.from.position.y - lineOffsetY + (nodeRadius + 10) * Math.sin(angle))
      ctx.lineTo(edge.to.position.x - lineOffsetX, edge.to.position.y - lineOffsetY)

      ctx.strokeStyle = getValue(edgeColor, edge)
      ctx.lineWidth = getValue(edgeWeight, edge)
      ctx.stroke()
      ctx.closePath()

      const { x: x1, y: y1 } = averageCoordsofTwoPoints(edge.from.position.x + lineOffsetX, edge.from.position.y + lineOffsetY, edge.to.position.x + lineOffsetX - (nodeRadius + 10) * Math.cos(angle), edge.to.position.y + lineOffsetY - (nodeRadius + 10) * Math.sin(angle))
      const { x: x2, y: y2 } = averageCoordsofTwoPoints(edge.from.position.x - lineOffsetX + (nodeRadius + 10) * Math.cos(angle), edge.from.position.y - lineOffsetY + (nodeRadius + 10) * Math.sin(angle), edge.to.position.x - lineOffsetX, edge.to.position.y - lineOffsetY)

      ctx.fillStyle = getValue(edgeTextColor, edge)
      ctx.textAlign = 'center'
      ctx.font = `${getValue(edgeTextSize, edge)}px Arial`
      ctx.fillText(`${edge.weight}`, x1, y1)
      ctx.fillText(`${edge.weight}`, x2, y2)

      drawArrow(edge.to.position.x + lineOffsetX, edge.to.position.y + lineOffsetY, angle)
      drawArrow(edge.from.position.x - lineOffsetX, edge.from.position.y - lineOffsetY, angle - Math.PI)
      // TODO: customize as option

    } else {
      ctx.beginPath()
      ctx.moveTo(edge.from.position.x, edge.from.position.y)
      ctx.lineTo(edge.to.position.x, edge.to.position.y)
      ctx.strokeStyle = getValue(edgeColor, edge)
      ctx.lineWidth = getValue(edgeWeight, edge)
      ctx.stroke()
      ctx.closePath()

      const { x, y } = averageCoordsofTwoPoints(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y)
      ctx.fillStyle = getValue(edgeTextColor, edge)
      ctx.textAlign = 'center'
      ctx.font = `${getValue(edgeTextSize, edge)}px Arial`
      ctx.fillText(`${edge.weight}`, x, y)
    }
  }

  const drawNode = (ctx: CanvasRenderingContext2D, node: GraphNode) => {
    ctx.beginPath()
    ctx.arc(node.position.x, node.position.y, nodeRadius - getValue(nodeBorderWeight, node), 0, Math.PI * 2)
    ctx.fillStyle = getValue(nodeColor, node)
    ctx.fill()
    ctx.closePath()
    ctx.strokeStyle = getValue(nodeBorderColor, node)
    ctx.lineWidth = getValue(nodeBorderWeight, node)
    ctx.stroke()
    ctx.closePath()
    ctx.fillStyle = getValue(nodeTextColor, node)
    ctx.textAlign = 'center'
    ctx.font = `${getValue(nodeTextSize, node)}px Arial`
    ctx.fillText(`${node.id}`, node.position.x, node.position.y + 5)
  }

  const drawAddNewEdgeWithMiniNode = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath()
    ctx.moveTo(draggingMiniNodeData.value!.origin.position.x, draggingMiniNodeData.value!.origin.position.y)
    ctx.lineTo(draggingMiniNodeData.value!.mousePosition.x, draggingMiniNodeData.value!.mousePosition.y)
    ctx.strokeStyle = getValue(edgeColor)
    ctx.lineWidth = getValue(edgeWeight) // TODO: make separate color/weight etc.
    ctx.stroke()
    ctx.closePath()
  }


  const animate = () => {
    draw()

    requestAnimationFrame(animate)
  }

  const timeoutIsActive = ref(false)

  const startTimeout = () => {
    timeoutIsActive.value = true

    setTimeout(() => {
      timeoutIsActive.value = false
    }, 300)
  }

  const onMouseDown = (event: MouseEvent) => {
    const mouseX = event.offsetX
    const mouseY = event.offsetY

    const hoveringMiniNodes = checkHoverMiniNodes(mouseX, mouseY, hoveredNode, draggingMiniNode)

    if (hoveringMiniNodes) {
      draggingMiniNode.value = true
      draggingMiniNodeData.value = {
        origin: hoveredNode.value!,
        mousePosition: {
          x: mouseX,
          y: mouseY
        }
      }
    } else {
      getNodes.value.forEach(node => {
        const dx = mouseX - node.position.x
        const dy = mouseY - node.position.y
        if ((dx * dx + dy * dy) < 2500) {
          isDragging.value = true
          draggedNode.value = node
        }
      })
    }

  }

  const onMouseMove = (event: MouseEvent) => {
    const mouseX = event.offsetX
    const mouseY = event.offsetY

    if (draggingMiniNode.value) {
      draggingMiniNodeData.value!.mousePosition = {
        x: mouseX,
        y: mouseY
      }
    }

    const nodeIndex = getNodes.value.findIndex(node => {
      const dx = mouseX - node.position.x
      const dy = mouseY - node.position.y
      const distanceSquared = dx * dx + dy * dy

      return distanceSquared < nodeRadius ** 2
    })

    const hoveringMiniNodes = checkHoverMiniNodes(mouseX, mouseY, hoveredNode, draggingMiniNode)

    if (nodeIndex !== -1) {
      hoveredNode.value = getNodes.value[nodeIndex]
    } else if (!hoveringMiniNodes) {
      if (!draggingMiniNode.value) {
        hoveredNode.value = null
        draggingMiniNodeData.value = null
      }
    }

    if (isDragging.value && draggedNode.value) {
      draggedNode.value.position.x = mouseX
      draggedNode.value.position.y = mouseY
    }
  }

  const onMouseUp = (event: MouseEvent) => {
    const mouseX = event.offsetX
    const mouseY = event.offsetY

    const clickedEdgeWeight = edges.findIndex(edge => {
      if (edge.directionType === 'both-ways') {
        const angle = Math.atan2(
          edge.to.position.y - edge.from.position.y,
          edge.to.position.x - edge.from.position.x
        )
        // TODO: need to separate the two-way edge into two edges. make sure they are always differentiable
        const lineOffsetX = 20 * Math.cos(angle + Math.PI / 2)
        const lineOffsetY = 20 * Math.sin(angle + Math.PI / 2)
        const { x: x1, y: y1 } = averageCoordsofTwoPoints(edge.from.position.x + lineOffsetX, edge.from.position.y + lineOffsetY, edge.to.position.x + lineOffsetX - (nodeRadius + 10) * Math.cos(angle), edge.to.position.y + lineOffsetY - (nodeRadius + 10) * Math.sin(angle))
        const { x: x2, y: y2 } = averageCoordsofTwoPoints(edge.from.position.x - lineOffsetX + (nodeRadius + 10) * Math.cos(angle), edge.from.position.y - lineOffsetY + (nodeRadius + 10) * Math.sin(angle), edge.to.position.x - lineOffsetX, edge.to.position.y - lineOffsetY)
        const dx1 = mouseX - x1
        const dy1 = mouseY - y1
        const distanceSquared1 = dx1 * dx1 + dy1 * dy1
        const dx2 = mouseX - x2
        const dy2 = mouseY - y2
        const distanceSquared2 = dx2 * dx2 + dy2 * dy2
        return distanceSquared1 < getValue(edgeTextSize) ** 2 || distanceSquared2 < getValue(edgeTextSize) ** 2
      } else {
        const { x, y } = averageCoordsofTwoPoints(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y)
        const dx = mouseX - x
        const dy = mouseY - y
        const distanceSquared = dx * dx + dy * dy
        return distanceSquared < getValue(edgeTextSize) ** 2
      }
    })

    if (clickedEdgeWeight !== -1 && !isDragging.value) {
      edgeOfClickedWeight.value = getEdges.value[clickedEdgeWeight]
      // const inputElement = document.createElement('div')
      // inputElement.style.position = 'absolute'
      // inputElement.style.left = `${mouseX}px`
      // inputElement.style.top = `${mouseY}px`
      // inputElement.innerHTML = `<input type="number" :v-model="${getEdges.value[clickedEdgeWeight].weight}" />`

      // const container = document.getElementById('dynamic-input-container')
      // if (container) container.appendChild(inputElement)

    } else {
      edgeOfClickedWeight.value = null
    }

    if (!isDragging.value && !draggingMiniNode.value && !edgeOfClickedWeight.value) {
      getEdges.value.forEach(edge => {
        if (distanceToLineSquared(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y, mouseX, mouseY) < edgeDistances[edge.directionType]) {
          updateEdgeType(edge.from.id, edge.to.id, edge.directionType)
          startTimeout()
        }
      })
    } else if (!isDragging.value && draggingMiniNode.value) {
      const nodeIndex = isMouseOnNode(getNodes, mouseX, mouseY)

      if (nodeIndex !== -1)
        addEdge(draggingMiniNodeData.value!.origin.id, getNodes.value[nodeIndex].id, 'undirected')
    }

    isDragging.value = false
    draggedNode.value = null
    draggingMiniNode.value = false
    draggingMiniNodeData.value = null
  }

  const onDoubleClick = (event: MouseEvent) => {
    const mouseX = event.offsetX
    const mouseY = event.offsetY
    const nodeIndex = isMouseOnNode(getNodes, mouseX, mouseY)

    if (nodeIndex !== -1) {
      deleteNode(getNodes.value[nodeIndex].id)
      hoveredNode.value = null
    } else if (!timeoutIsActive.value && !edgeOfClickedWeight.value) {
      addNode(mouseX, mouseY)
    } else if (!isDragging.value && !draggingMiniNode.value && !edgeOfClickedWeight.value) {
      getEdges.value.forEach(edge => {
        if (distanceToLineSquared(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y, mouseX, mouseY) < edgeDistances[edge.directionType]) {
          deleteEdge(edge.from.id, edge.to.id)
        }
      })
    }
  }

  onMounted(() => {
    animate()

    if (canvas.value) {
      canvas.value.addEventListener('mousedown', onMouseDown)
      canvas.value.addEventListener('mousemove', onMouseMove)
      canvas.value.addEventListener('dblclick', onDoubleClick)
      canvas.value.addEventListener('mouseup', onMouseUp)
      canvas.value.addEventListener('mouseleave', onMouseUp) // Ensure dragging stops if mouse leaves canvas
    }
  })


  const getNodes = computed(() => nodes)
  const getEdges = computed(() => edges)

  return {
    nodes: getNodes,
    edges: getEdges,
    edgeDistances,
    addNode,
    addEdge,
    deleteNode,
    deleteEdge,
    updateEdgeType
  }
}


export default useGraph