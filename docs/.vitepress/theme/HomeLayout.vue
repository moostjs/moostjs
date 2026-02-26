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

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const route = useRoute()

const activeTab = ref('http')
const tiltDeg = ref(2)

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

onMounted(setupScrollAnimations)
watch(() => route.path, setupScrollAnimations)

const features = [
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>`,
        title: 'No modules. No middleware.',
        details: 'Register controllers directly — no providers arrays, no forRoot(), no import/export ceremonies. DI resolves dependencies globally.',
        link: '/moost/why',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
        title: 'Resolvers decouple your logic',
        details: 'Decorator-based resolvers inject params, headers, body — your handlers stay pure and testable. Swap real data for mocks with zero changes to business logic.',
        link: '/moost/pipes/resolve',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
        title: 'One framework. Every event type.',
        details: 'HTTP, WebSocket, CLI, Workflows — the same controllers, DI, interceptors, and pipes work everywhere. Write an auth guard once, apply it anywhere.',
        link: '/moost/',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        title: 'DI without the ritual',
        details: '@Injectable() with constructor types. Singleton or per-event scope. @Provide() / @Inject() to swap implementations. No ceremony.',
        link: '/moost/di/',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`,
        title: 'Build your own decorators',
        details: 'Create custom decorators in a few lines with a typed metadata store. No Reflect.metadata boilerplate — just typed reads and writes.',
        link: '/moost/meta/custom#creating-custom-decorators',
    },
    {
        icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6.49999H7.5M12 6.49999H7.5M7.5 6.49999V18M21 7.49999C16.5 3 10.3027 10.8181 17 12C25 13.4118 20.5 20.5 14 17" stroke-width="1.5" stroke-linecap="round" stroke="currentColor"/></svg>`,
        title: 'TypeScript-first',
        details: 'Fully typed composables, route params, and DI resolution. Strict mode throughout. Not a JS framework with .d.ts files bolted on.',
    },
]
</script>

<template>
    <Layout>
        <template #home-hero-before>
            <div class="VPHero">
                <div
                    class="container"
                    style="display: flex; flex-direction: column"
                >
                    <div class="main">
                        <img
                            src="/moost-full-logo.png"
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
                    <h2 class="section-heading animate-in">Same app. Less boilerplate. Better focus.</h2>
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
            <!-- DTO Validation Comparison -->
            <section class="code-section">
                <div class="code-section-inner">
                    <h2 class="section-heading animate-in"><span class="tlhl">Simplify</span> Your DTOs.</h2>
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
        </template>
    </Layout>
</template>

<style scoped>
.VPHero {
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
:global(.dark) .feature-card:hover,
html.dark .feature-card:hover {
    box-shadow: 0 8px 24px rgba(87, 127, 230, 0.2);
}
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
:global(.dark) .moost-block,
html.dark .moost-block {
    box-shadow: 0 0 40px rgba(255, 39, 155, 0.25), 0 0 80px rgba(255, 39, 155, 0.15);
    border-color: rgba(255, 39, 155, 0.4);
}

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
:global(.dark) .tab-back-card,
html.dark .tab-back-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.tab-content {
    position: relative;
    border-radius: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
}
:global(.dark) .tab-content,
html.dark .tab-content {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
}
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
</style>
