<script setup lang="ts">
import { ref } from 'vue'
import useGraph from '../composables/useHandleGraph'

const canvas = ref<HTMLCanvasElement | null>(null)

useGraph(canvas)

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
  background-color: rgb(55 65 81);
}
</style>
