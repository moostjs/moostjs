<template>
  <nav>
    <router-link to="/">Home</router-link> |
    <router-link to="/about">About</router-link>
  </nav>
  <router-view />
</template>

<style>
nav {
  padding: 0.75rem 1rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
}
nav a {
  color: #577fe6;
  text-decoration: none;
  font-size: 0.9rem;
}
nav a:hover {
  color: #88a7f5;
}
nav a.router-link-exact-active {
  color: #ff279b;
}
</style>
