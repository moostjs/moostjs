<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = withDefaults(
  defineProps<{
    title?: string
    data: Record<string, Record<string, number>>
    mode?: 'grouped' | 'stacked'
    unit?: string
    height?: number
  }>(),
  {
    mode: 'grouped',
    unit: 'req/s',
    height: 0,
  },
)

const categoryPalette = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const categoryPaletteDark = ['#818cf8', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c']

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

// Stacked mode: transpose — Y-axis = inner keys (frameworks), datasets = outer keys (categories)
const stackedItems = computed(() => {
  const all = new Set<string>()
  for (const cat of Object.values(props.data)) {
    for (const k of Object.keys(cat)) all.add(k)
  }
  return [...all]
})
const stackedCategories = computed(() => Object.keys(props.data))
const stackedDatasets = computed(() => {
  const palette = isDark.value ? categoryPaletteDark : categoryPalette
  return stackedCategories.value.map((cat, i) => ({
    label: cat,
    data: stackedItems.value.map((item) => props.data[cat]?.[item] ?? 0),
    backgroundColor: palette[i % palette.length],
    borderRadius: 0,
    borderSkipped: false as const,
    barThickness: 26,
  }))
})

const labels = computed(() => stackedItems.value)
const datasets = computed(() => stackedDatasets.value)

const chartHeight = computed(() => {
  if (props.height) return props.height
  return Math.max(260, labels.value.length * 48 + 80)
})

const chartData = computed(() => ({
  labels: labels.value,
  datasets: datasets.value,
}))

const textColor = computed(() => (isDark.value ? '#d1d5db' : '#374151'))
const gridColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'))

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: textColor.value,
        padding: 16,
        usePointStyle: true,
        pointStyle: 'rectRounded',
        font: { size: 12 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const v = ctx.raw as number
          return `${ctx.dataset.label}: ${v.toLocaleString()} ${props.unit}`
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      ticks: {
        color: textColor.value,
        callback: (v: any) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
        font: { size: 11 },
      },
      grid: { color: gridColor.value },
    },
    y: {
      stacked: true,
      ticks: {
        color: textColor.value,
        font: {
          size: 13,
          weight: 'bold' as const,
        },
      },
      grid: { color: gridColor.value },
    },
  },
}))

const chartKey = computed(() => `chart-${isDark.value}-${props.mode}`)
</script>

<template>
  <div class="benchmark-chart">
    <h4 v-if="title" class="benchmark-chart-title">{{ title }}</h4>
    <div class="benchmark-chart-container" :style="{ height: chartHeight + 'px' }">
      <Bar :key="chartKey" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.benchmark-chart {
  margin: 1.5rem 0;
}

.benchmark-chart-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.benchmark-chart-container {
  position: relative;
  width: 100%;
}
</style>
