<template>
  <div ref="el" class="chart-base" :style="{ height: typeof height === 'number' ? height + 'px' : height }" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, RadarChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, LineChart, RadarChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent,
  CanvasRenderer,
])

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: [Number, String], default: 300 },
})

const el = ref(null)
let chart = null
let observer = null

onMounted(() => {
  chart = echarts.init(el.value)
  chart.setOption(props.option)
  observer = new ResizeObserver(() => chart && chart.resize())
  observer.observe(el.value)
})

watch(
  () => props.option,
  (opt) => {
    if (chart && opt) chart.setOption(opt, true)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.chart-base { width: 100%; min-width: 0; }
</style>
