<template>
  <div class="about">
    <h1>About</h1>
    <p>This is a full-stack SSR starter built with Moost, Vite, and Vue.</p>

    <h2>Ecosystem</h2>
    <div class="links">
      <a href="https://moost.org" target="_blank" class="link-card">
        <strong>Moost</strong>
        <span>TypeScript framework with NestJS-style controllers, DI, pipes, and interceptors.</span>
      </a>
      <a href="https://wooks.moost.org" target="_blank" class="link-card">
        <strong>Wooks</strong>
        <span>Composable event processing framework. The HTTP engine behind Moost.</span>
      </a>
      <a href="https://atscript.dev" target="_blank" class="link-card">
        <strong>Atscript</strong>
        <span>A powerful data definition language and framework, seamlessly integrated into Moost.</span>
      </a>
      <a href="https://db.atscript.dev" target="_blank" class="link-card">
        <strong>Atscript DB</strong>
        <span>A database layer for Atscript.</span>
      </a>
    </div>

    <h2>Tooling</h2>
    <div class="links">
      <a href="https://vite.dev" target="_blank" class="link-card">
        <strong>Vite</strong>
        <span>Next-generation frontend tooling with Oxc and Rolldown.</span>
      </a>
      <a href="https://vuejs.org" target="_blank" class="link-card">
        <strong>Vue.js</strong>
        <span>The progressive JavaScript framework for building user interfaces.</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.about {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #dfdfd6;
}
h1 {
  color: #88a7f5;
  margin: 0 0 0.5rem;
}
h2 {
  color: #577fe6;
  font-size: 1.1rem;
  margin: 1.5rem 0 0.75rem;
}
h1 + p {
  color: #98989f;
  margin: 0 0 1rem;
}
.links {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.link-card {
  display: block;
  padding: 1rem 1.25rem;
  background: #1c2b59;
  border: 1px solid #273760;
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s;
}
.link-card:hover {
  border-color: #577fe6;
}
.link-card strong {
  display: block;
  color: #ff279b;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
}
.link-card span {
  color: #98989f;
  font-size: 0.85rem;
  line-height: 1.4;
}
</style>
