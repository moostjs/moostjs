<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = withDefaults(
  defineProps<{
    title?: string
    data: Record<string, number>
    unit?: string
    height?: number
  }>(),
  {
    unit: 'req/s',
    height: 0,
  },
)

const frameworkColors: Record<string, string> = {
  'Moost': '#6366f1',
  'NestJS (Fastify)': '#ef4444',
  'NestJS (Express)': '#f59e0b',
}

const frameworkColorsDark: Record<string, string> = {
  'Moost': '#818cf8',
  'NestJS (Fastify)': '#f87171',
  'NestJS (Express)': '#fbbf24',
}

const isDark = ref(false)

function detectDark() {
  if (typeof document !== 'undefined') {
    isDark.value = document.documentElement.classList.contains('dark')
  }
}

onMounted(() => {
  detectDark()
  const observer = new MutationObserver(detectDark)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

const labels = computed(() => Object.keys(props.data))
const values = computed(() => Object.values(props.data))

const chartHeight = computed(() => {
  if (props.height) return props.height
  return Math.max(160, labels.value.length * 44 + 40)
})

const textColor = computed(() => (isDark.value ? '#d1d5db' : '#374151'))
const gridColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      data: values.value,
      backgroundColor: labels.value.map((name) => {
        const colors = isDark.value ? frameworkColorsDark : frameworkColors
        return colors[name] ?? '#666666'
      }),
      borderRadius: 4,
      barThickness: 28,
      borderSkipped: false as const,
    },
  ],
}))

const valueLabelPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx
    const meta = chart.getDatasetMeta(0)
    if (!meta?.data) return
    meta.data.forEach((bar: any, i: number) => {
      const value = chart.data.datasets[0].data[i]
      const barColor = chart.data.datasets[0].backgroundColor[i]
      ctx.save()
      ctx.fillStyle = barColor || (isDark.value ? '#d1d5db' : '#374151')
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${value.toLocaleString()} ${props.unit}`, bar.x + 8, bar.y)
      ctx.restore()
    })
  },
}

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { right: 120 },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.raw.toLocaleString()} ${props.unit}`,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: textColor.value,
        callback: (v: any) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
        font: { size: 11 },
      },
      grid: { color: gridColor.value },
    },
    y: {
      ticks: {
        color: textColor.value,
        font: { size: 13, weight: 'bold' as const },
      },
      grid: { display: false },
    },
  },
}))

const chartKey = computed(() => `bars-${isDark.value}`)
</script>

<template>
  <div class="benchmark-bars">
    <h4 v-if="title" class="benchmark-bars-title">{{ title }}</h4>
    <div class="benchmark-bars-container" :style="{ height: chartHeight + 'px' }">
      <Bar :key="chartKey" :data="chartData" :options="chartOptions" :plugins="[valueLabelPlugin]" />
    </div>
  </div>
</template>

<style scoped>
.benchmark-bars {
  margin: 1.5rem 0;
}

.benchmark-bars-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.benchmark-bars-container {
  position: relative;
  width: 100%;
}
</style>
