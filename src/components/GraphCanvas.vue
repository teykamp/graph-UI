<script setup lang="ts">
import { ref, onMounted } from 'vue'
import useGraph from '../composables/useHandleGraph'

const { nodes, edges, edgeDistances, addNode, addEdge, deleteNode, deleteEdge, updateEdgeType } = useGraph()

const nodeRadius = 50
const miniNodeRadius = 10

const miniNodeOffsets = {
  'top': {
    x: 0,
    y: -nodeRadius
  },
  'right': {
    x: nodeRadius,
    y: 0
  },
  'bottom': {
    x: 0,
    y: nodeRadius
  },
  'left': {
    x: -nodeRadius,
    y: 0
  },
}

interface GraphNode {
  id: number
  position: { x: number, y: number }
  connectedNodes: Set<GraphNode>
}

addNode(100, 100)
addNode(500, 100)
addNode(400, 900)

addEdge(2, 3, 'one-way')
addEdge(1, 3, 'both-ways')
addEdge(2, 1, 'undirected')

const hoveredMiniNode = ref<{ x: number, y: number, fromNode: GraphNode } | null>(null)
const draggedMiniNode = ref<{ x: number, y: number } | null>(null)
const isDragging = ref(false)
const draggedNode = ref<GraphNode | null>(null)
const hoveredNode = ref<GraphNode | null>(null)
const offset = ref({ x: 0, y: 0 })

const canvas = ref<HTMLCanvasElement | null>(null)

const drawMiniNodes = (ctx: CanvasRenderingContext2D, originX: number, originY: number) => {

  if (draggedMiniNode.value) return

  Object.values(miniNodeOffsets).forEach(miniNode => {
    ctx.beginPath()
    ctx.arc(originX + miniNode.x, originY + miniNode.y, miniNodeRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'black'
    ctx.fill()
    ctx.closePath()
  })
}

const drawEdge = (ctx: CanvasRenderingContext2D, edge: Edge) => {
  if (edge.directionType === 'one-way') {
    const angle = Math.atan2(
      edge.to.position.y - edge.from.position.y,
      edge.to.position.x - edge.from.position.x
    )
    ctx.beginPath()
    ctx.moveTo(edge.from.position.x, edge.from.position.y)
    ctx.lineTo(edge.to.position.x - (nodeRadius + 10) * Math.cos(angle), edge.to.position.y - (nodeRadius + 10) * Math.sin(angle))
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.closePath()
  
    const endX = edge.to.position.x
    const endY = edge.to.position.y
    const offset = nodeRadius

    const offsetX = endX - offset * Math.cos(angle)
    const offsetY = endY - offset * Math.sin(angle)

    ctx.beginPath()
    ctx.moveTo(offsetX, offsetY)
    ctx.lineTo(
      offsetX - 30 * Math.cos(angle - Math.PI / 6),
      offsetY - 30 * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      offsetX - 30 * Math.cos(angle + Math.PI / 6),
      offsetY - 30 * Math.sin(angle + Math.PI / 6)
    )
    ctx.lineTo(offsetX, offsetY)
    ctx.fillStyle = 'black'
    ctx.fill()
    ctx.closePath()

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

    ctx.strokeStyle = 'black'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.closePath()

    // arrows
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
      ctx.fillStyle = 'black'
      ctx.fill()
      ctx.closePath()
    }
    drawArrow(edge.to.position.x + lineOffsetX, edge.to.position.y + lineOffsetY, angle)
    drawArrow(edge.from.position.x - lineOffsetX, edge.from.position.y - lineOffsetY, angle - Math.PI)

  } else {
    ctx.beginPath()
    ctx.moveTo(edge.from.position.x, edge.from.position.y)
    ctx.lineTo(edge.to.position.x, edge.to.position.y)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.closePath()
  }
}

const draw = (ctx: CanvasRenderingContext2D) => {
  const width = canvas.value!.width
  const height = canvas.value!.height
  ctx.clearRect(0, 0, width, height)

  if (draggedMiniNode.value && hoveredMiniNode.value) {
    ctx.beginPath()
    ctx.moveTo(hoveredMiniNode.value.x, hoveredMiniNode.value.y)
    ctx.lineTo(draggedMiniNode.value.x, draggedMiniNode.value.y)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.closePath()
  }

  edges.value.forEach(edge => {
    drawEdge(ctx, edge)
  })

  nodes.value.forEach(node => {
    ctx.beginPath()
    ctx.arc(node.position.x, node.position.y, nodeRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'blue'
    ctx.fill()
    ctx.closePath()
    ctx.fillStyle = 'white'
    ctx.font = 'italic 20px Arial'
    ctx.fillText(`${node.id}`, node.position.x  - 5, node.position.y + 5)
  })

  if (hoveredNode.value && !isDragging.value) {
    drawMiniNodes(ctx, hoveredNode.value.position.x, hoveredNode.value.position.y)
  }
}

const animate = () => {
  const canvasContext = canvas.value?.getContext('2d')

  if (canvasContext) draw(canvasContext)

  requestAnimationFrame(animate)
}

const distanceToLineSquared = (x1: number, y1: number, x2: number, y2: number, px: number, py: number) => {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const len_sq = C * C + D * D
  const param = len_sq !== 0 ? dot / len_sq : -1

  let nearestX, nearestY

  if (param < 0) {
    nearestX = x1
    nearestY = y1
  } else if (param > 1) {
    nearestX = x2
    nearestY = y2
  } else {
    nearestX = x1 + param * C
    nearestY = y1 + param * D
  }

  const dx = px - nearestX
  const dy = py - nearestY
  return dx * dx + dy * dy
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

  if (hoveredMiniNode.value) {
    draggedMiniNode.value = {
      x: mouseX,
      y: mouseY
    }
  } else {
    nodes.value.forEach(node => {
      const dx = mouseX - node.position.x
      const dy = mouseY - node.position.y
      if ((dx * dx + dy * dy) < 2500) {
        isDragging.value = true
        draggedNode.value = node
        offset.value = { x: dx, y: dy }
      }
    })
  }

}

const onMouseMove = (event: MouseEvent) => {
  const mouseX = event.offsetX
  const mouseY = event.offsetY

  if (draggedMiniNode.value) {
    draggedMiniNode.value = {
      x: mouseX,
      y: mouseY
    }
  }

  const nodeIndex = nodes.value.findIndex(node => {
    const dx = mouseX - node.position.x
    const dy = mouseY - node.position.y
    const distanceSquared = dx * dx + dy * dy

    return distanceSquared < nodeRadius ** 2
  })

  let topNode, bottomNode, leftNode, rightNode
  if (hoveredNode.value && !draggedMiniNode.value) {
    topNode =
      mouseY >= hoveredNode.value.position.y - nodeRadius - miniNodeRadius &&
      mouseY <= hoveredNode.value.position.y - nodeRadius + miniNodeRadius &&
      mouseX >= hoveredNode.value.position.x - miniNodeRadius &&
      mouseX <= hoveredNode.value.position.x + nodeRadius
  
    bottomNode =
      mouseY >= hoveredNode.value.position.y + nodeRadius - miniNodeRadius &&
      mouseY <= hoveredNode.value.position.y + nodeRadius + miniNodeRadius &&
      mouseX >= hoveredNode.value.position.x - miniNodeRadius &&
      mouseX <= hoveredNode.value.position.x + miniNodeRadius
  
    leftNode =
      mouseY >= hoveredNode.value.position.y - miniNodeRadius &&
      mouseY <= hoveredNode.value.position.y + miniNodeRadius &&
      mouseX >= hoveredNode.value.position.x - nodeRadius - miniNodeRadius &&
      mouseX <= hoveredNode.value.position.x - nodeRadius + miniNodeRadius
  
    rightNode =
      mouseY >= hoveredNode.value.position.y - miniNodeRadius &&
      mouseY <= hoveredNode.value.position.y + miniNodeRadius &&
      mouseX >= hoveredNode.value.position.x + nodeRadius - miniNodeRadius &&
      mouseX <= hoveredNode.value.position.x + nodeRadius + miniNodeRadius
  }

  if (topNode || bottomNode || leftNode || rightNode) {
      hoveredMiniNode.value = { x: hoveredNode.value!.position.x, y: hoveredNode.value!.position.y, fromNode: hoveredNode.value! }
  } else if (nodeIndex !== -1) {
      hoveredNode.value = nodes.value[nodeIndex]
  } else {
    if (!draggedMiniNode.value) {
      hoveredNode.value = null
      hoveredMiniNode.value = null
    }
  }

  if (isDragging.value && draggedNode.value) {
    draggedNode.value.position.x = mouseX - offset.value.x
    draggedNode.value.position.y = mouseY - offset.value.y
  }
}

const onMouseUp = (event: MouseEvent) => {
  const mouseX = event.offsetX
  const mouseY = event.offsetY
  if (!isDragging.value && !draggedMiniNode.value) {
    edges.value.forEach(edge => {
      if (distanceToLineSquared(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y, mouseX, mouseY) < edgeDistances[edge.directionType]) {
        updateEdgeType(edge.from.id, edge.to.id, edge.directionType)
        startTimeout()
      }
    })
  } else if (!isDragging.value && draggedMiniNode.value && hoveredMiniNode.value) {
    const nodeIndex = nodes.value.findIndex(node => {
      const dx = mouseX - node.position.x
      const dy = mouseY - node.position.y
      const distanceSquared = dx * dx + dy * dy

      return distanceSquared < nodeRadius ** 2
    })

    if (nodeIndex !== -1 && hoveredMiniNode.value.fromNode)
    addEdge(hoveredMiniNode.value.fromNode.id, nodes.value[nodeIndex].id, 'undirected')
  }

  isDragging.value = false
  draggedNode.value = null
  draggedMiniNode.value = null
  hoveredMiniNode.value = null
}

const onDoubleClick = (event: MouseEvent) => {
  const mouseX = event.offsetX
  const mouseY = event.offsetY
  const nodeIndex = nodes.value.findIndex(node => {
    const dx = mouseX - node.position.x
    const dy = mouseY - node.position.y
    return dx * dx + dy * dy < 50 ** 2
  })

  if (nodeIndex !== -1) {
    deleteNode(nodes.value[nodeIndex].id)
    hoveredNode.value = null
  } else if (!timeoutIsActive.value) {
    addNode(mouseX, mouseY)
  } else if (!isDragging.value && !draggedMiniNode.value) {
    edges.value.forEach(edge => {
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
    canvas.value.addEventListener('mouseup', onMouseUp)
    canvas.value.addEventListener('mouseleave', onMouseUp) // Ensure dragging stops if mouse leaves canvas
    canvas.value.addEventListener('dblclick', onDoubleClick)
  }
})
</script>

<template>
  <canvas 
    ref="canvas"
    :height="1000"
    :width="1000" 
  ></canvas>
</template>

<style scoped>
canvas {
  border: 1px solid black;
}
</style>
