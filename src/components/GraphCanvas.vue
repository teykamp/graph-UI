<script setup lang="ts">
import { ref, onMounted } from 'vue'
import useGraph from '../composables/useHandleGraph'
import { nodeRadius, miniNodeRadius, miniNodeOffsets } from '../utils/constants'
import { checkHoverMiniNodes, distanceToLineSquared, isMouseOnNode } from '../utils/mouseGeometry'
import type { GraphNode, Edge } from '../utils/types.ts'

const isDragging = ref(false)
const draggedNode = ref<GraphNode | null>(null)
const hoveredNode = ref<GraphNode | null>(null)
const draggingMiniNode = ref(false)
const draggingMiniNodeData = ref<{ origin: GraphNode, mousePosition: { x: number, y: number } } | null>(null)

const canvas = ref<HTMLCanvasElement | null>(null)

const { nodes, edges, edgeDistances, addNode, addEdge, deleteNode, deleteEdge, updateEdgeType } = useGraph(canvas.value)

const drawMiniNodes = (ctx: CanvasRenderingContext2D, originX: number, originY: number) => {

  if (draggingMiniNode.value) return

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

const drawNode = (ctx: CanvasRenderingContext2D, node: GraphNode) => {
  ctx.beginPath()
  ctx.arc(node.position.x, node.position.y, nodeRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'blue'
  ctx.fill()
  ctx.closePath()
  ctx.fillStyle = 'white'
  ctx.font = 'italic 20px Arial'
  ctx.fillText(`${node.id}`, node.position.x - 5, node.position.y + 5)
}

const draw = (ctx: CanvasRenderingContext2D) => {
  const width = canvas.value!.width
  const height = canvas.value!.height
  ctx.clearRect(0, 0, width, height)

  if (draggingMiniNode.value) {
    ctx.beginPath()
    ctx.moveTo(draggingMiniNodeData.value!.origin.position.x, draggingMiniNodeData.value!.origin.position.y)
    ctx.lineTo(draggingMiniNodeData.value!.mousePosition.x, draggingMiniNodeData.value!.mousePosition.y)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.closePath()
  }

  edges.value.forEach(edge => {
    drawEdge(ctx, edge)
  })

  nodes.value.forEach(node => {
    drawNode(ctx, node)
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
    nodes.value.forEach(node => {
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

  const nodeIndex = nodes.value.findIndex(node => {
    const dx = mouseX - node.position.x
    const dy = mouseY - node.position.y
    const distanceSquared = dx * dx + dy * dy

    return distanceSquared < nodeRadius ** 2
  })

  const hoveringMiniNodes = checkHoverMiniNodes(mouseX, mouseY, hoveredNode, draggingMiniNode)

  if (nodeIndex !== -1) {
    hoveredNode.value = nodes.value[nodeIndex]
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
  if (!isDragging.value && !draggingMiniNode.value) {
    edges.value.forEach(edge => {
      if (distanceToLineSquared(edge.from.position.x, edge.from.position.y, edge.to.position.x, edge.to.position.y, mouseX, mouseY) < edgeDistances[edge.directionType]) {
        updateEdgeType(edge.from.id, edge.to.id, edge.directionType)
        startTimeout()
      }
    })
  } else if (!isDragging.value && draggingMiniNode.value) {
    const nodeIndex = isMouseOnNode(nodes, mouseX, mouseY)

    if (nodeIndex !== -1)
    addEdge(draggingMiniNodeData.value!.origin.id, nodes.value[nodeIndex].id, 'undirected')
  }

  isDragging.value = false
  draggedNode.value = null
  draggingMiniNode.value = false
  draggingMiniNodeData.value = null
}

const onDoubleClick = (event: MouseEvent) => {
  const mouseX = event.offsetX
  const mouseY = event.offsetY
  const nodeIndex = isMouseOnNode(nodes, mouseX, mouseY)

  if (nodeIndex !== -1) {
    deleteNode(nodes.value[nodeIndex].id)
    hoveredNode.value = null
  } else if (!timeoutIsActive.value) {
    addNode(mouseX, mouseY)
  } else if (!isDragging.value && !draggingMiniNode.value) {
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
    canvas.value.addEventListener('dblclick', onDoubleClick)
    canvas.value.addEventListener('mouseup', onMouseUp)
    canvas.value.addEventListener('mouseleave', onMouseUp) // Ensure dragging stops if mouse leaves canvas
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
