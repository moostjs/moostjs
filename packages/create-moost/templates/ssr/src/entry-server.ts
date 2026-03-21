import { renderToString } from 'vue/server-renderer'
import { createApp } from './app'

export async function render(url: string) {
  const { app, router } = createApp()
  await router.push(url)
  await router.isReady()

  const ctx: Record<string, any> = {}
  const html = await renderToString(app, ctx)

  const state = JSON.stringify(ctx.state || {})
  return { html, state }
}
