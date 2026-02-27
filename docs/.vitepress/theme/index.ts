import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent, nextTick } from 'vue'
import HomeLayout from './HomeLayout.vue'
import './custom.css'

function colorizeAtscriptAnnotations() {
    if (typeof window === 'undefined') return
    const lines = window.document.querySelectorAll('.language-atscript code .line')
    lines.forEach((line) => {
        line.querySelectorAll('span').forEach((span) => {
            if (span.textContent && span.textContent.trim().startsWith('@')) {
                span.style.color = '#2baac4ff'
                span.style.fontWeight = '600'
            }
        })
    })
}

export default {
    extends: DefaultTheme,
    Layout: HomeLayout,
    enhanceApp({ app }) {
        app.component('BenchmarkBars', defineAsyncComponent(() => import('./BenchmarkBars.vue')))
        app.component('BenchmarkChart', defineAsyncComponent(() => import('./BenchmarkChart.vue')))
        app.mixin({
            mounted() { nextTick(colorizeAtscriptAnnotations) },
            updated() { nextTick(colorizeAtscriptAnnotations) },
        })
    },
}
