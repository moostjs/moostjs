<template>
  <div class="home">
    <div class="hero">
      <a href="https://moost.org" target="_blank">
        <img src="/moost-logo.svg" alt="Moost" height="128px" class="logo-moost" />
      </a>
      <div class="powered-by">
        <span>powered by</span>
        <div class="sub-logos">
          <a href="https://vite.dev" target="_blank">
            <img src="/vite-logo.svg" alt="Vite" height="32px" class="logo-sub" />
          </a>
          <span class="plus">+</span>
          <a href="https://vuejs.org" target="_blank">
            <img src="/vue-logo.svg" alt="Vue" height="32px" class="logo-sub" />
          </a>
        </div>
      </div>
      <p class="tagline">Full-stack SSR with decorator-driven API, zero-config HMR, and local fetch</p>
    </div>

    <div class="cards">
      <div class="card">
        <h2>SSR Fetch</h2>
        <p class="description">
          Data below was fetched from <code>/api/hello/SSR</code> during server rendering.
          On the server, <code>fetch()</code> calls the Moost handler directly in-process — no HTTP roundtrip.
        </p>
        <pre v-if="ssrData" class="result">{{ JSON.stringify(ssrData, null, 2) }}</pre>
        <p v-else class="loading">Loading...</p>
        <p class="note" v-if="fetchSource">Fetched via: <strong>{{ fetchSource }}</strong></p>
      </div>

      <div class="card">
        <h2>Client Hydration</h2>
        <p class="description">
          This counter was server-rendered at <strong>{{ count }}</strong> and hydrated on the client.
        </p>
        <div class="counter">
          <button @click="count--">-</button>
          <span>{{ count }}</span>
          <button @click="count++">+</button>
        </div>
      </div>

      <div class="card">
        <h2>Client Fetch</h2>
        <p class="description">Click to fetch from the API on the client side (real HTTP request).</p>
        <button class="fetch-btn" @click="clientFetch">Fetch /api/hello/World</button>
        <pre v-if="clientData" class="result">{{ JSON.stringify(clientData, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onServerPrefetch, onMounted, useSSRContext } from 'vue'

const count = ref(0)
const clientData = ref<any>(null)
const fetchSource = ref('')

// Restore SSR state on client, or initialize empty
const ssrState = import.meta.env.SSR ? useSSRContext()! : (window as any).__SSR_STATE__ || {}
const ssrData = ref<any>(ssrState.ssrData || null)

if (ssrData.value) {
  fetchSource.value = 'server (local fetch)'
}

// SSR: fetch runs on the server via local moost handler (no HTTP roundtrip)
onServerPrefetch(async () => {
  const res = await fetch('/api/hello/SSR')
  ssrData.value = await res.json()
  fetchSource.value = 'server (local fetch)'
  // Save to SSR context for client hydration
  ssrState.state = ssrState.state || {}
  ssrState.state.ssrData = ssrData.value
})

// Client fallback: fetch if SSR data wasn't available (SPA mode or no state transfer)
onMounted(async () => {
  if (!ssrData.value) {
    const res = await fetch('/api/hello/SSR')
    ssrData.value = await res.json()
    fetchSource.value = 'client (HTTP)'
  }
})

async function clientFetch() {
  const res = await fetch('/api/hello/World')
  clientData.value = await res.json()
}
</script>

<style scoped>
.home {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #dfdfd6;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2.5rem;
}
.logo-moost {
  height: 128px;
  margin-bottom: 1rem;
  transition: transform 0.2s;
}
.logo-moost:hover {
  transform: scale(1.05);
}
.powered-by {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}
.powered-by span {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #6a6a71;
}
.sub-logos {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.logo-sub {
  height: 32px;
  transition: transform 0.2s;
}
.logo-sub:hover {
  transform: scale(1.1);
}
.plus {
  font-size: 1.25rem;
  color: #577fe6;
  font-weight: 300;
}
.tagline {
  text-align: center;
  color: #98989f;
  margin: 0;
  font-size: 0.95rem;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.card {
  border: 1px solid #273760;
  border-radius: 10px;
  padding: 1.25rem;
  background: #1c2b59;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  color: #88a7f5;
}
.description {
  color: #98989f;
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.5;
}
code {
  background: #212e51;
  color: #ff279b;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.85em;
}
.result {
  background: #0e1c41;
  color: #a8e6cf;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  overflow-x: auto;
  margin: 0.5rem 0;
  border: 1px solid #273760;
}
.note {
  font-size: 0.8rem;
  color: #6a6a71;
  margin: 0.5rem 0 0;
}
.note strong {
  color: #ff279b;
}
.loading {
  color: #6a6a71;
  font-style: italic;
}
.counter {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.counter span {
  font-size: 1.5rem;
  min-width: 2rem;
  text-align: center;
  color: #dfdfd6;
}
.counter button,
.fetch-btn {
  padding: 0.4rem 1rem;
  border: 1px solid #3d61be;
  border-radius: 6px;
  background: #212e51;
  color: #dfdfd6;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.counter button:hover,
.fetch-btn:hover {
  background: #273760;
  border-color: #577fe6;
}
</style>
