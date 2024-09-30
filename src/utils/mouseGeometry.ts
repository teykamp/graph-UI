import type { Ref, ComputedRef, Reactive } from 'vue'
import { nodeRadius, miniNodeRadius } from './constants'
import type { GraphNode } from './types.ts'


export const distanceToLineSquared = (x1: number, y1: number, x2: number, y2: number, px: number, py: number) => {
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

export const averageCoordsofTwoPoints = (x1: number, y1: number, x2: number, y2: number) => {
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2
  }
}

export const checkHoverMiniNodes = (mouseX: number, mouseY: number, hoveredNode: Ref<GraphNode | null>, draggingMiniNode: Ref<boolean>) => {
  let topNode, bottomNode, leftNode, rightNode
  if (hoveredNode.value && !draggingMiniNode.value) {
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

  return topNode || bottomNode || leftNode || rightNode
}

export const isMouseOnNode = (nodes: ComputedRef<Reactive<GraphNode[]>>, mouseX: number, mouseY: number) => {
  return nodes.value.findIndex(node => {
    const dx = mouseX - node.position.x
    const dy = mouseY - node.position.y
    const distanceSquared = dx * dx + dy * dy
    return distanceSquared < nodeRadius ** 2
  })
}