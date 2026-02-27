<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useData } from 'vitepress'

const { isDark } = useData()

const SVG_W = 1200
const SVG_H = 1500

// Base paths drawn once (no overlap on trunk)
const trunkPath = 'M -24 250 H 700'
const R = 12
const branchPaths = [
    { id: 'b1', d: `M 700 250 A ${R} ${R} 0 0 0 712 238 V 162 A ${R} ${R} 0 0 1 724 150 H 1224` },
    { id: 'b2', d: `M 700 250 A ${R} ${R} 0 0 0 712 238 V 222 A ${R} ${R} 0 0 1 724 210 H 1224` },
    { id: 'b3', d: `M 700 250 A ${R} ${R} 0 0 1 712 262 V 278 A ${R} ${R} 0 0 0 724 290 H 1224` },
    { id: 'b4', d: `M 700 250 A ${R} ${R} 0 0 1 712 262 V 338 A ${R} ${R} 0 0 0 724 350 H 1224` },
]

// Full signal paths (trunk + branch) for traveling dash animation
const signalPaths = [
    { id: 's1', d: `M -24 250 H 700 A ${R} ${R} 0 0 0 712 238 V 162 A ${R} ${R} 0 0 1 724 150 H 1224` },
    { id: 's2', d: `M -24 250 H 700 A ${R} ${R} 0 0 0 712 238 V 222 A ${R} ${R} 0 0 1 724 210 H 1224` },
    { id: 's3', d: `M -24 250 H 700 A ${R} ${R} 0 0 1 712 262 V 278 A ${R} ${R} 0 0 0 724 290 H 1224` },
    { id: 's4', d: `M -24 250 H 700 A ${R} ${R} 0 0 1 712 262 V 338 A ${R} ${R} 0 0 0 724 350 H 1224` },
]

// Node blocks along the paths
const nodes = [
    // Trunk
    { x: 200, y: 250, pathIndex: 0 },
    { x: 450, y: 250, pathIndex: 0 },
    // Branch 1 (y=150)
    { x: 1060, y: 150, pathIndex: 0 },
    // Branch 2 (y=210)
    { x: 1000, y: 210, pathIndex: 1 },
    // Branch 3 (y=290)
    { x: 1000, y: 290, pathIndex: 2 },
    // Branch 4 (y=350)
    { x: 1060, y: 350, pathIndex: 3 },
]

const signalRefs = ref<(SVGPathElement | null)[]>([])
const nodeRefs = ref<(SVGRectElement | null)[]>([])

function setSignalRef(el: any, i: number) {
    signalRefs.value[i] = el as SVGPathElement
}
function setNodeRef(el: any, i: number) {
    nodeRefs.value[i] = el as SVGRectElement
}

function findDistanceAlongPath(path: SVGPathElement, x: number, y: number): number {
    const totalLen = path.getTotalLength()
    let best = 0
    let bestDist = Infinity
    for (let len = 0; len <= totalLen; len += 5) {
        const pt = path.getPointAtLength(len)
        const dist = (pt.x - x) ** 2 + (pt.y - y) ** 2
        if (dist < bestDist) {
            bestDist = dist
            best = len
        }
    }
    return best
}

onMounted(() => {
    const SPEED = 500
    const TRAVEL_PCT = 0.3

    const pathLengths: number[] = []
    const durations: number[] = []

    signalRefs.value.forEach((el, i) => {
        if (el) {
            const len = el.getTotalLength()
            pathLengths[i] = len
            const duration = len / (SPEED * TRAVEL_PCT)
            durations[i] = duration
            el.style.setProperty('--path-length', String(len))
            el.style.setProperty('--duration', `${duration}s`)
            el.style.strokeDasharray = `40 ${len - 40}`
            el.style.strokeDashoffset = String(len)
        }
    })

    nodes.forEach((node, ni) => {
        const nodeEl = nodeRefs.value[ni]
        const pathEl = signalRefs.value[node.pathIndex]
        if (!nodeEl || !pathEl) return
        const totalLen = pathLengths[node.pathIndex]
        const duration = durations[node.pathIndex]
        if (!totalLen || !duration) return

        const dist = findDistanceAlongPath(pathEl, node.x, node.y)
        const fraction = dist / totalLen
        const glowDelay = fraction * duration * TRAVEL_PCT
        nodeEl.style.setProperty('--glow-delay', `${glowDelay}s`)
        nodeEl.style.setProperty('--glow-duration', `${duration}s`)
    })
})
</script>

<template>
    <div class="event-flow-bg" :class="{ dark: isDark }" aria-hidden="true">
        <svg
            :viewBox="`0 -500 ${SVG_W} ${SVG_H}`"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
        >
            <!-- Base route lines (trunk drawn once, branches drawn once) -->
            <path :d="trunkPath" class="route-base" stroke-width="1.5" stroke-linecap="round" />
            <path
                v-for="branch in branchPaths"
                :key="branch.id"
                :d="branch.d"
                class="route-base"
                stroke-width="1.5"
                stroke-linecap="round"
            />

            <!-- Signal paths (full trunk+branch, animated traveling dash) -->
            <path
                v-for="(sp, i) in signalPaths"
                :key="sp.id"
                :ref="(el: any) => setSignalRef(el, i)"
                :d="sp.d"
                class="signal-path"
                stroke-width="3"
                stroke-linecap="round"
            />

            <!-- Node blocks -->
            <rect
                v-for="(node, i) in nodes"
                :key="'node-' + i"
                :ref="(el: any) => setNodeRef(el, i)"
                :x="node.x - 18"
                :y="node.y - 4"
                width="36"
                height="8"
                rx="3"
                class="node-block"
            />
        </svg>
    </div>
</template>

<style scoped>
.event-flow-bg {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
    background: transparent !important;
}

.event-flow-bg svg {
    width: 100%;
    height: 100%;
    display: block;
    opacity: 0.15;
    transform-origin: 50% 50%;
    transform: perspective(500px) rotateY(-25deg) rotateX(0deg) rotateZ(4deg) scale(1) translateX(-150px);
    -webkit-mask-image: linear-gradient(
        135deg,
        transparent 0%,
        transparent 15%,
        rgba(0, 0, 0, 0.3) 35%,
        rgba(0, 0, 0, 1) 60%
    );
    mask-image: linear-gradient(
        135deg,
        transparent 0%,
        transparent 15%,
        rgba(0, 0, 0, 0.3) 35%,
        rgba(0, 0, 0, 1) 60%
    );
}


@media (max-width: 1220px) {
    .event-flow-bg svg {
        transform: perspective(400px) rotateY(-20deg) rotateX(0deg) rotateZ(4deg) scale(1.25) translateX(-100px);
    }
}

@media (max-width: 820px) {
    .event-flow-bg svg {
        transform: perspective(300px) rotateY(-15deg) rotateX(0deg) rotateZ(4deg) scale(2) translateX(-100px);
    }
}

@media (max-width: 600px) {
    .event-flow-bg svg {
        transform: perspective(300px) rotateY(-15deg) rotateX(0deg) rotateZ(4deg) scale(3) translateX(-100px);
    }
}

.dark svg {
    opacity: 0.25;
}

/* Route wires */
.route-base {
    stroke: #577fe6;
}
.dark .route-base {
    stroke: #6e91e7;
}

/* Fork point */
.fork-point {
    fill: #577fe6;
}
.dark .fork-point {
    fill: #6e91e7;
}

/* Signal traveling along the path */
.signal-path {
    stroke: #ff279b;
    filter: brightness(1) drop-shadow(0 0 8px rgb(255, 117, 191));
    stroke-dasharray: 40 2000;
    stroke-dashoffset: 2000;
    animation: signal-travel var(--duration, 8s) linear infinite;
}
.dark .signal-path {
    stroke: #ff279b;
    filter: brightness(1) drop-shadow(0 0 8px rgb(255, 117, 191));
}

@keyframes signal-travel {
    0% {
        stroke-dashoffset: var(--path-length, 2000);
        stroke-opacity: 1;
    }
    30% {
        stroke-dashoffset: 0;
        stroke-opacity: 1;
    }
    32% {
        stroke-opacity: 0;
    }
    100% {
        stroke-opacity: 0;
    }
}

/* Node blocks with glow synced to signal */
.node-block {
    fill: #577fe6;
    animation: node-glow-dark var(--glow-duration, 8s) linear infinite;
    animation-delay: var(--glow-delay, 0s);
}
html.dark .node-block {
    fill: #6e91e7;
    animation-name: node-glow-dark;
}

@keyframes node-glow-dark {
    0% {
        fill: #ff6bba;
        filter: brightness(1) drop-shadow(0 0 12px rgb(255, 117, 191));
    }
    10%,
    100% {
        fill: #6e91e7;
        filter: brightness(1);
    }
}

@media (prefers-reduced-motion: reduce) {
    .signal-path {
        animation: none;
        stroke-dasharray: none;
    }
    .node-block {
        animation: none;
    }
}
</style>
