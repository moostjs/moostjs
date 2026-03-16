<script setup>
import { onMounted, nextTick, watch, ref, computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import SnippetNestJS from './snippets/compare-nestjs.md'
import SnippetMoost from './snippets/compare-moost.md'
import SnippetHttp from './snippets/domain-http.md'
import SnippetWs from './snippets/domain-ws.md'
import SnippetCli from './snippets/domain-cli.md'
import SnippetWf from './snippets/domain-wf.md'
import SnippetDtoNestJS from './snippets/dto-nestjs.md'
import SnippetDtoMoost from './snippets/dto-moost.md'
import EventFlowBg from './EventFlowBg.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const route = useRoute()

const activeTab = ref('http')
const tiltDeg = ref(2)
const perfTarget = 66049
const perfDisplay = ref('0')
const perfStripRef = ref(null)
const perfIconRef = ref(null)
const perfLinkRef = ref(null)

function animateNumber(target, duration = 1000) {
    const start = performance.now()
    function update(now) {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic: decelerates toward the end
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(eased * target)
        const str = String(current).padStart(5, '0')
        perfDisplay.value = str.slice(0, 2) + ',' + str.slice(2)
        if (progress < 1) {
            requestAnimationFrame(update)
        } else {
            if (perfIconRef.value) {
                perfIconRef.value.classList.add('pop')
            }
            if (perfLinkRef.value) {
                perfLinkRef.value.classList.add('shine')
            }
        }
    }
    requestAnimationFrame(update)
}

const tabs = [
    { id: 'http', label: 'HTTP', link: '/webapp/' },
    { id: 'ws', label: 'WebSocket', link: '/wsapp/' },
    { id: 'cli', label: 'CLI', link: '/cliapp/' },
    { id: 'wf', label: 'Workflows', link: '/wf/' },
]

function switchTab(id) {
    activeTab.value = id
    const sign = Math.random() > 0.5 ? 1 : -1
    tiltDeg.value = sign * (1.5 + Math.random() * 1.5)
}

const backCardStyle = computed(() => ({
    transform: `rotate(${tiltDeg.value}deg)`,
}))

const activeLink = computed(() => tabs.find((t) => t.id === activeTab.value)?.link ?? '/')

function setupScrollAnimations() {
    nextTick(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add('visible')
                        observer.unobserve(e.target)
                    }
                })
            },
            { threshold: 0.1 }
        )
        document.querySelectorAll('.animate-in').forEach((el) => {
            el.classList.remove('visible')
            observer.observe(el)
        })
    })
}

function setupPerfObserver() {
    nextTick(() => {
        if (perfStripRef.value) {
            perfDisplay.value = '0'
            if (perfIconRef.value) {
                perfIconRef.value.classList.remove('pop')
            }
            if (perfLinkRef.value) {
                perfLinkRef.value.classList.remove('shine')
            }
            const perfObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach((e) => {
                        if (e.isIntersecting) {
                            animateNumber(perfTarget)
                            perfObserver.unobserve(e.target)
                        }
                    })
                },
                { threshold: 0.3 }
            )
            perfObserver.observe(perfStripRef.value)
        }
    })
}

onMounted(() => {
    setupScrollAnimations()
    setupPerfObserver()
})
watch(() => route.path, () => {
    setupScrollAnimations()
    setupPerfObserver()
})

const features = [
    {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M13.065 8.272a1.866 1.866 0 0 0-1.867-1.865c-.327 0-.48.087-.763.25l-.17-2.172a.933.933 0 0 0-.932-.933L7.42 3.347c.165-.284.254-.4.255-.728a1.866 1.866 0 1 0-3.732 0c0 .328.084.444.249.728l-2.324.205a.933.933 0 0 0-.933.933l.03 1.065c.012.468.472.801.928.912c.33.08.639.246.883.49a1.866 1.866 0 0 1 0 2.64a1.87 1.87 0 0 1-.883.49c-.456.11-.916.442-.93.911l-.027.957c0 .247.098.484.273.66c1.36.899 7.607.807 8.784 0a.93.93 0 0 0 .273-.66l.17-2.064c.283.164.435.25.762.25a1.866 1.866 0 0 0 1.867-1.864" stroke-width="1"/></svg>`,
        title: 'No modules. No middleware.',
        details: 'Register controllers directly. No modules, no providers arrays, no import/export ceremonies. Keep the structure, drop the framework ritual.',
        link: '/moost/why',
    },
    {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M19.254 2.292a.75.75 0 0 1 .954.461A28.1 28.1 0 0 1 21.75 12a28.1 28.1 0 0 1-1.542 9.247a.75.75 0 1 1-1.416-.494c.94-2.7 1.458-5.654 1.458-8.753s-.519-6.054-1.458-8.754a.75.75 0 0 1 .461-.954m-14.228.013a.75.75 0 0 1 .414.976A23.2 23.2 0 0 0 3.75 12c0 3.085.6 6.027 1.69 8.718a.75.75 0 0 1-1.39.563c-1.161-2.867-1.8-6-1.8-9.281c0-3.28.639-6.414 1.8-9.281a.75.75 0 0 1 .976-.414m4.275 5.052a1.5 1.5 0 0 1 2.21.803l.716 2.148L13.6 8.246a2.44 2.44 0 0 1 2.978-.892l.213.09a.75.75 0 1 1-.584 1.381l-.214-.09a.94.94 0 0 0-1.145.343l-2.021 3.033l1.084 3.255l1.445-.89a.75.75 0 1 1 .786 1.278l-1.444.889a1.5 1.5 0 0 1-2.21-.803l-.716-2.148l-1.374 2.062a2.44 2.44 0 0 1-2.978.892l-.213-.09a.75.75 0 0 1 .584-1.381l.214.09a.94.94 0 0 0 1.145-.344l2.021-3.032l-1.084-3.255l-1.445.89a.75.75 0 1 1-.786-1.278z" clip-rule="evenodd"/></svg>`,
        title: 'Data on demand via Wooks',
        details: 'Headers, cookies, params, and bodies are resolved only when your handler asks for them. Less hidden work, cleaner code, better hot paths.',
        link: '/moost/why',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
        title: 'One framework. Every event type.',
        details: 'HTTP, WebSocket, CLI, Workflows — the same controllers, DI, interceptors, and pipes work everywhere. Write an auth guard once, apply it anywhere.',
        link: '/moost/',
    },
]
</script>

<template>
    <Layout>
        <template #home-hero-before>
            <div class="VPHero" style=" overflow: visible;">
                <div
                    class="container"
                    style="display: flex; flex-direction: column; position: relative; overflow: visible;"
                >
                <EventFlowBg />
                    <div class="main">
                        <img
                            src="/moost-full-logo.svg"
                            alt="Moost"
                            style="width: 400px; margin-bottom: 32px"
                        />
                        <p class="text">{{ frontmatter.hero2.text }}</p>
                        <p class="tagline">
                            {{ frontmatter.hero2.tl1 }}
                            <strong style="color: #ff269b">{{ frontmatter.hero2.tlhl }}</strong>
                            {{ frontmatter.hero2.tl2 }}
                        </p>

                        <div v-if="frontmatter.actions" class="actions">
                            <div
                                v-for="action in frontmatter.actions"
                                :key="action.link"
                                class="action"
                            >
                                <VPButton
                                    tag="a"
                                    size="medium"
                                    :theme="action.theme"
                                    :text="action.text"
                                    :href="action.link"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <section class="features-section">
                <div class="features-inner">
                    <div class="features-grid">
                        <a
                            v-for="(f, i) in features"
                            :key="i"
                            :href="f.link"
                            class="feature-card"
                            :style="{ '--delay': `${i * 0.07}s` }"
                        >
                            <div class="feature-icon" v-html="f.icon" />
                            <div class="feature-body">
                                <h3 class="feature-title">{{ f.title }}</h3>
                                <p class="feature-details">{{ f.details }}</p>
                            </div>
                        </a>
                    </div>
                </div>
            </section>

            <!-- Before/After Code Comparison -->
            <section class="code-section bg-diagonal bg-diagonal-1">
                <div class="code-section-inner">
                    <h2 class="section-heading animate-in">Same architecture. Less framework work.</h2>
                    <div class="comparison-grid animate-in">
                        <div class="comparison-col">
                            <div class="comparison-label nestjs-label">NestJS <span class="file-count">5 files</span></div>
                            <div class="comparison-block">
                                <SnippetNestJS />
                            </div>
                        </div>
                        <div class="comparison-arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div class="comparison-col moost-col">
                            <div class="comparison-label moost-label">Moost <span class="file-count">2 files</span></div>
                            <div class="comparison-block moost-block">
                                <SnippetMoost />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Performance Strip -->
            <section ref="perfStripRef" class="perf-strip animate-in">
                <div class="perf-strip-inner">
                    <div ref="perfIconRef" class="perf-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" d="M11 14H6L9.5 2H16l-3 8h5l-8 12z"/></svg>
                    </div>
                    <div class="perf-content">
                        <div class="perf-number"><span class="perf-value">{{ perfDisplay }}</span> <span class="perf-unit">req/s</span></div>
                        <div class="perf-text">21-route SaaS benchmark — about 10% ahead of NestJS + Fastify on weighted throughput.</div>
                    </div>
                    <a ref="perfLinkRef" href="/webapp/benchmarks" class="perf-link">See benchmarks &rarr;</a>
                </div>
            </section>

            <!-- Tabbed Domain Showcase -->
            <section class="code-section showcase-section animate-in">
                <div class="code-section-inner">
                    <h2 class="section-heading" style="text-align: center">One pattern. Every event type.</h2>
                    <p class="showcase-subheading">
                        HTTP, WebSocket, CLI, Workflows — the same controllers, DI, and decorators everywhere.
                    </p>

                    <div class="tab-bar">
                        <button
                            v-for="tab in tabs"
                            :key="tab.id"
                            :class="['tab-btn', { active: activeTab === tab.id }]"
                            @click="switchTab(tab.id)"
                        >
                            {{ tab.label }}
                        </button>
                    </div>

                    <div class="tab-stack">
                        <div class="tab-back-card" :style="backCardStyle" />
                        <a :href="activeLink" class="try-it-btn">Docs &rarr;</a>
                        <div class="tab-content">
                            <SnippetHttp v-show="activeTab === 'http'" />
                            <SnippetWs v-show="activeTab === 'ws'" />
                            <SnippetCli v-show="activeTab === 'cli'" />
                            <SnippetWf v-show="activeTab === 'wf'" />
                        </div>
                    </div>
                </div>
            </section>

            <!-- DTO Validation Comparison -->
            <section class="code-section">
                <div class="code-section-inner">
                    <h2 class="section-heading animate-in">Works even better with Atscript.</h2>
                    <div class="atscript-promo animate-in">
                        <a
                            href="https://atscript.moost.org"
                            target="_blank"
                            rel="noreferrer"
                            class="atscript-promo-link"
                        >
                            <img
                                src="https://atscript.moost.org/logo.svg"
                                alt="Atscript"
                                class="atscript-promo-logo"
                            />
                            <span>Explore Atscript docs &rarr;</span>
                        </a>
                    </div>
                    <p class="showcase-subheading animate-in" style="max-width: 760px;">
                        Use Atscript for DTO validation without class-validator decorators or extra nested DTO classes.
                    </p>
                    <div class="comparison-grid animate-in">
                        <div class="comparison-col">
                            <div class="comparison-label nestjs-label">NestJS + class-validator <span class="file-count">2 files</span></div>
                            <div class="comparison-block">
                                <SnippetDtoNestJS />
                            </div>
                        </div>
                        <div class="comparison-arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div class="comparison-col moost-col">
                            <div class="comparison-label moost-label">Moost + Atscript <span class="file-count">1 file</span> <a href="/validation/" class="label-link">Learn more &rarr;</a></div>
                            <div class="comparison-block moost-block">
                                <SnippetDtoMoost />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </template>
    </Layout>
</template>

<style scoped>
.VPHero {
    position: relative;
    overflow: hidden;
    margin-top: calc(
        (var(--vp-nav-height) + var(--vp-layout-top-height, 0px)) * -1
    );
    padding: calc(
            var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 48px
        )
        24px 48px;
}
@media (min-width: 640px) {
    .VPHero {
        padding: calc(
                var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 64px
            )
            48px 64px;
    }
}
@media (min-width: 960px) {
    .VPHero {
        padding: calc(
                var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 64px
            )
            64px 64px;
    }
}
.container {
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    max-width: 1152px;
}
@media (min-width: 960px) {
    .container {
        flex-direction: row;
    }
}
.main {
    position: relative;
    z-index: 10;
    order: 2;
    flex-grow: 1;
    flex-shrink: 0;
}
.VPHero.has-image .container {
    text-align: center;
}
@media (min-width: 960px) {
    .VPHero.has-image .container {
        text-align: left;
    }
}
@media (min-width: 960px) {
    .main {
        order: 1;
        width: 100%;
    }
    .VPHero.has-image .main {
        max-width: 100%;
        width: 100%;
    }
}
.name,
.text {
    letter-spacing: -0.4px;
    line-height: 40px;
    font-size: 32px;
    font-weight: 700;
    white-space: pre-wrap;
}
.VPHero.has-image .name,
.VPHero.has-image .text {
    margin: 0 auto;
}
.name {
    color: var(--vp-home-hero-name-color);
}
.clip {
    background: var(--vp-home-hero-name-background);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: var(--vp-home-hero-name-color);
}
@media (min-width: 640px) {
    .name,
    .text {
        line-height: 56px;
        font-size: 48px;
    }
}
@media (min-width: 960px) {
    .name,
    .text {
        line-height: 64px;
        font-size: 56px;
    }
    .VPHero.has-image .name,
    .VPHero.has-image .text {
        margin: 0;
    }
}
.tagline {
    padding-top: 8px;
    max-width: 392px;
    line-height: 28px;
    font-size: 18px;
    font-weight: 500;
    white-space: pre-wrap;
    color: var(--vp-c-text-2);
}
.VPHero.has-image .tagline {
    margin: 0 auto;
}
@media (min-width: 640px) {
    .tagline {
        padding-top: 12px;
        max-width: 576px;
        line-height: 32px;
        font-size: 20px;
    }
}
@media (min-width: 960px) {
    .tagline {
        line-height: 36px;
        font-size: 24px;
    }
    .VPHero.has-image .tagline {
        margin: 0;
    }
}
.actions {
    display: flex;
    flex-wrap: wrap;
    margin: -6px;
    padding-top: 24px;
}
.VPHero.has-image .actions {
    justify-content: center;
}
@media (min-width: 640px) {
    .actions {
        padding-top: 32px;
    }
}
@media (min-width: 960px) {
    .VPHero.has-image .actions {
        justify-content: flex-start;
    }
}
.action {
    flex-shrink: 0;
    padding: 6px;
}

/* ---- Feature Tiles ---- */
.features-section {
    padding: 0 24px 48px;
}
@media (min-width: 640px) {
    .features-section {
        padding: 0 48px;
    }
}
@media (min-width: 960px) {
    .features-section {
        padding: 0 64px;
    }
}
.features-inner {
    margin: 0 auto;
    max-width: 1152px;
}
.features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
}
@media (min-width: 640px) {
    .features-grid {
        grid-template-columns: 1fr 1fr;
    }
}
@media (min-width: 960px) {
    .features-grid {
        grid-template-columns: 1fr 1fr 1fr;
    }
}
.feature-card {
    display: flex;
    gap: 16px;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    text-decoration: none;
    color: inherit;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.25s ease,
                border-color 0.25s ease;
    animation: feature-fade-in 0.5s ease both;
    animation-delay: var(--delay);
}
.feature-card:hover {
    transform: translateY(-4px);
    border-color: var(--vp-c-brand);
    box-shadow: 0 8px 24px rgba(87, 127, 230, 0.12);
}
/* :global(.dark) .feature-card:hover,
html.dark .feature-card:hover {
    box-shadow: 0 8px 24px rgba(87, 127, 230, 0.2);
} */
@keyframes feature-fade-in {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.feature-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 6px;
    border-radius: 8px;
    background: rgba(87, 127, 230, 0.1);
    color: var(--vp-c-brand);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                background 0.25s ease;
}
.feature-card:hover .feature-icon {
    transform: scale(1.15) rotate(-5deg);
    background: rgba(87, 127, 230, 0.18);
}
.feature-icon :deep(svg) {
    width: 100%;
    height: 100%;
}
.feature-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--vp-c-text-1);
    margin-bottom: 4px;
    line-height: 1.4;
}
.feature-details {
    font-size: 13px;
    color: var(--vp-c-text-2);
    line-height: 1.5;
    margin: 0;
}

/* ---- Code Comparison Section ---- */
.code-section {
    padding: 32px 24px;
    position: relative;
}
@media (min-width: 640px) {
    .code-section {
        padding: 64px 48px;
    }
}
@media (min-width: 960px) {
    .code-section {
        padding: 64px 64px;
    }
}

/* --- Diagonal slash background --- */
.bg-diagonal {
    padding-top: 80px !important;
    padding-bottom: 80px !important;
}
.bg-diagonal::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--vp-c-bg-soft);
}
.bg-diagonal-1::before {
    clip-path: polygon(0 50px, 100% 0, 100% 100%, 0 calc(100% - 50px));
}
.code-section-inner {
    max-width: 1152px;
    margin: 0 auto;
}
.section-heading {
    font-size: 24px;
    font-weight: 700;
    color: var(--vp-c-text-1);
    margin-bottom: 24px;
}
@media (min-width: 640px) {
    .section-heading {
        font-size: 28px;
    }
}
.comparison-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    align-items: center;
    min-width: 0;
}
.comparison-col {
    min-width: 0;
}
.comparison-arrow {
    display: flex;
    justify-content: center;
    align-self: center;
    color: var(--vp-c-text-3);
}
.comparison-arrow svg {
    transform: rotate(90deg);
}
@media (min-width: 768px) {
    .comparison-grid {
        grid-template-columns: 1fr auto 1fr;
        gap: 16px;
    }
    .comparison-arrow svg {
        transform: rotate(0deg);
    }
}
.comparison-block {
    border-radius: 0 0 12px 12px;
    overflow: hidden;
    border: 1px solid var(--vp-c-divider);
    border-top: none;
    background: var(--vp-c-bg);
}
:global(.dark) .comparison-block,
html.dark .comparison-block {
    border-color: rgba(255, 255, 255, 0.06);
}
.comparison-label {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border-radius: 12px 12px 0 0;
}
.nestjs-label {
    background: rgba(128, 128, 128, 0.1);
    color: var(--vp-c-text-2);
}
.moost-label {
    background: rgba(87, 127, 230, 0.15);
    color: var(--vp-c-brand);
}
:global(.dark) .moost-label,
html.dark .moost-label {
    background: rgba(255, 39, 155, 0.12);
    color: #ff279b;
}
.file-count {
    font-weight: 400;
    font-size: 12px;
    opacity: 0.7;
    margin-left: 4px;
}
.label-link {
    float: right;
    font-size: 12px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    color: var(--vp-c-brand);
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.2s;
}
.label-link:hover {
    opacity: 1;
}
/* Reset VitePress code block chrome inside comparison */
.comparison-block :deep(div[class*="language-"]) {
    margin: 0 !important;
    border-radius: 0;
    background: var(--vp-c-bg) !important;
}
.comparison-block :deep(button.copy),
.comparison-block :deep(span.lang) {
    display: none;
}
.comparison-block :deep(pre) {
    padding: 0 !important;
    margin: 0 !important;
    overflow-x: auto;
}
.comparison-block :deep(code) {
    display: block;
    width: fit-content;
    min-width: 100%;
    padding: 8px 20px;
    font-size: 13px;
}
.comparison-block :deep(.file-sep) {
    padding: 4px 16px;
    font-size: 12px;
    font-family: var(--vp-font-family-mono);
    color: var(--vp-c-text-2);
    background: var(--vp-c-bg-alt);
    border-top: 1px solid var(--vp-c-divider);
}
:global(.dark) .comparison-block :deep(.file-sep),
html.dark .comparison-block :deep(.file-sep) {
    border-top-color: rgba(255, 255, 255, 0.06);
}
.comparison-block :deep(.file-sep:first-child) {
    border-top: none;
}

/* Moost snippet glow */
.moost-block {
    box-shadow: 0 0 40px rgba(87, 127, 230, 0.2), 0 0 80px rgba(87, 127, 230, 0.1);
    border-color: rgba(87, 127, 230, 0.3);
}
/* :global(.dark) .moost-block,
html.dark .moost-block {
    box-shadow: 0 0 40px rgba(255, 39, 155, 0.25), 0 0 80px rgba(255, 39, 155, 0.15);
    border-color: rgba(255, 39, 155, 0.4);
} */

/* ---- Tabbed Domain Showcase ---- */
.showcase-section {
    background: var(--vp-c-bg-soft);
}
.showcase-subheading {
    font-size: 16px;
    color: var(--vp-c-text-2);
    text-align: center;
    margin-top: -12px;
    margin-bottom: 24px;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}
.atscript-promo {
    display: flex;
    justify-content: center;
    margin: -6px 0 18px;
}
.atscript-promo-link {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 999px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    text-decoration: none;
    transition: border-color 0.2s, transform 0.2s, background 0.2s;
}
.atscript-promo-link:hover {
    border-color: var(--vp-c-brand);
    background: var(--vp-c-bg-elv);
    transform: translateY(-1px);
}
.atscript-promo-logo {
    width: 28px;
    height: 28px;
    display: block;
}
.tab-bar {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}
.tab-btn {
    padding: 8px 20px;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
}
.tab-btn:hover {
    color: var(--vp-c-text-1);
    border-color: var(--vp-c-brand);
}
.tab-btn.active {
    background: var(--vp-c-brand);
    color: #fff;
    border-color: var(--vp-c-brand);
}
.tab-stack {
    position: relative;
    max-width: 720px;
    margin: 0 auto;
}
.tab-back-card {
    position: absolute;
    inset: 4px -2px -4px 2px;
    border-radius: 12px;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    opacity: 0.5;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* :global(.dark) .tab-back-card,
html.dark .tab-back-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
} */
.tab-content {
    position: relative;
    border-radius: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* :global(.dark) .tab-content,
html.dark .tab-content {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
} */

.tab-content :deep(div[class*="language-"]) {
    margin: 0;
    border-radius: 0;
    background: var(--vp-c-bg) !important;
}
.tab-content :deep(button.copy),
.tab-content :deep(span.lang) {
    display: none;
}
.tab-content :deep(pre) {
    padding: 0 !important;
}
.tab-content :deep(code) {
    display: block;
    width: fit-content;
    min-width: 100%;
    padding: 0 20px;
    font-size: 13px;
}
.try-it-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    padding: 4px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--vp-c-text-3);
    background: var(--vp-c-bg);
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s;
}
.try-it-btn:hover {
    color: var(--vp-c-brand);
    border-color: var(--vp-c-brand);
}

/* ---- Scroll reveal animations ---- */
.animate-in {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.6s ease, transform 0.6s ease;
}
.animate-in.visible {
    opacity: 1;
    transform: translateY(0);
}

/* ---- Unused hero image styles (kept for potential future use) ---- */
.image {
    order: 1;
    margin: -76px -24px -48px;
}
@media (min-width: 640px) {
    .image {
        margin: -108px -24px -48px;
    }
}
@media (min-width: 960px) {
    .image {
        flex-grow: 1;
        order: 2;
        margin: 0;
        min-height: 100%;
    }
}
.image-container {
    position: relative;
    margin: 0 auto;
    width: 320px;
    height: 320px;
}
@media (min-width: 640px) {
    .image-container {
        width: 392px;
        height: 392px;
    }
}
@media (min-width: 960px) {
    .image-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        transform: translate(-32px, -32px);
    }
}
.image-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    border-radius: 50%;
    width: 192px;
    height: 192px;
    background-image: var(--vp-home-hero-image-background-image);
    filter: var(--vp-home-hero-image-filter);
    transform: translate(-50%, -50%);
}
@media (min-width: 640px) {
    .image-bg {
        width: 256px;
        height: 256px;
    }
}
@media (min-width: 960px) {
    .image-bg {
        width: 320px;
        height: 320px;
    }
}
:deep(.image-src) {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: 192px;
    transform: translate(-50%, -50%);
}
@media (min-width: 640px) {
    :deep(.image-src) {
        max-width: 256px;
    }
}
@media (min-width: 960px) {
    :deep(.image-src) {
        max-width: 320px;
    }
}

/* ---- Performance Strip ---- */
.perf-strip {
    padding: 8px 24px 40px;
}
.perf-strip-inner {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 28px 32px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(87, 127, 230, 0.08) 0%, rgba(87, 127, 230, 0.03) 100%);
    border: 1px solid rgba(87, 127, 230, 0.2);
}
:global(.dark) .perf-strip-inner {
    background: linear-gradient(135deg, rgba(87, 127, 230, 0.15) 0%, rgba(87, 127, 230, 0.05) 100%);
    border-color: rgba(87, 127, 230, 0.25);
}
.perf-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    padding: 8px;
    border-radius: 12px;
    background: rgba(87, 127, 230, 0.12);
    color: var(--vp-c-brand);
}
:global(.dark) .perf-icon {
    background: rgba(87, 127, 230, 0.2);
}
.perf-icon svg {
    width: 100%;
    height: 100%;
}
.perf-icon.pop {
    animation: icon-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes icon-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.5); }
    100% { transform: scale(1); }
}
.perf-content {
    flex: 1;
    min-width: 0;
}
.perf-number {
    font-size: 36px;
    font-weight: 800;
    color: var(--vp-c-brand);
    letter-spacing: -1px;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.perf-value {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
}
.perf-unit {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0;
}
.perf-text {
    font-size: 14px;
    color: var(--vp-c-text-2);
    line-height: 1.5;
    margin-top: 4px;
}
.perf-link {
    flex-shrink: 0;
    padding: 8px 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--vp-c-brand);
    text-decoration: none;
    white-space: nowrap;
    border: 1px solid rgba(87, 127, 230, 0.3);
    border-radius: 8px;
    transition: all 0.2s;
}
.perf-link:hover {
    background: rgba(87, 127, 230, 0.08);
    border-color: var(--vp-c-brand);
}
.perf-link.shine {
    animation: link-pulse 2s ease-in-out infinite;
}
@keyframes link-pulse {
    0%, 100% { box-shadow: 0 0 6px 2px rgba(87, 127, 230, 0.25); }
    50% { box-shadow: 0 0 12px 4px rgba(87, 127, 230, 0.5); }
}
@media (max-width: 639px) {
    .perf-strip-inner {
        flex-direction: column;
        text-align: center;
        padding: 24px 20px;
    }
    .perf-number {
        font-size: 32px;
    }
}
@media (min-width: 640px) {
    .perf-strip {
        padding: 8px 48px 48px;
    }
    .perf-number {
        font-size: 40px;
    }
}
</style>
