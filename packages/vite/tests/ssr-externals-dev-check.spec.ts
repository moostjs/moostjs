import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PLUGIN_NO_EXTERNAL } from '../src/ssr-externals-check'
import {
  createDevInlineCheck,
  findDevSplitPackages,
  formatDevSplitPackagesWarning,
} from '../src/ssr-externals-dev-check'

function pkg(dir: string, name: string, extra: Record<string, unknown> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...extra }))
}

describe('dev split check', () => {
  let root: string

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'moost-dev-split-')))
    const nm = join(root, 'node_modules')
    pkg(root, 'app', {
      dependencies: {
        'some-db-lib': '*',
        moost: '*',
        '@moostjs/event-http': '*',
        '@moostjs/vite': '*',
      },
      devDependencies: { 'linked-lib': '*', vue: '*' },
    })
    pkg(join(nm, 'moost'), 'moost')
    pkg(join(nm, '@moostjs/event-http'), '@moostjs/event-http', {
      peerDependencies: { moost: '*' },
    })
    pkg(join(nm, 'some-db-lib'), 'some-db-lib', {
      peerDependencies: { '@moostjs/event-http': '*', moost: '*' },
    })
    pkg(join(nm, 'vue'), 'vue')
    pkg(join(nm, '@moostjs/vite'), '@moostjs/vite', { peerDependencies: { moost: '*' } })
    // a linked workspace package: resolves outside node_modules
    pkg(join(root, 'packages/linked-lib'), 'linked-lib', { dependencies: { moost: '*' } })
    symlinkSync(join(root, 'packages/linked-lib'), join(nm, 'linked-lib'), 'dir')
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('mirrors Vite: external list > noExternal > node_modules (external) vs linked (inlined)', () => {
    const inlined = createDevInlineCheck(root, {
      external: ['linked-lib'],
      noExternal: ['@moostjs/*', PLUGIN_NO_EXTERNAL],
    })
    expect(inlined('@moostjs/event-http')).toBe(true) // glob in noExternal
    expect(inlined('moost')).toBe(false) // in node_modules
    expect(inlined('linked-lib')).toBe(false) // listed in external
    expect(inlined('not-installed')).toBe(false)

    const defaults = createDevInlineCheck(root, { external: [], noExternal: [PLUGIN_NO_EXTERNAL] })
    expect(defaults('linked-lib')).toBe(true) // linked → inlined by default
    expect(createDevInlineCheck(root, { noExternal: true })('moost')).toBe(true)
    expect(createDevInlineCheck(root, { external: true, noExternal: [] })('linked-lib')).toBe(false)
  })

  it('stays quiet with the default dev config (the runtime is external)', () => {
    expect(
      findDevSplitPackages({ root, config: { external: [], noExternal: [PLUGIN_NO_EXTERNAL] } }),
    ).toEqual([])
  })

  it('flags an external that depends on a runtime package forced into the runner', () => {
    const found = findDevSplitPackages({
      root,
      config: { external: [], noExternal: ['@moostjs/event-http', PLUGIN_NO_EXTERNAL] },
    })
    expect(found).toEqual([{ name: 'some-db-lib', via: [], splitDeps: ['@moostjs/event-http'] }])
  })

  it('reports an inlined moost against the plugin itself', () => {
    const found = findDevSplitPackages({
      root,
      config: { external: [], noExternal: [/^moost$/, PLUGIN_NO_EXTERNAL] },
    })
    expect(found[0]).toEqual({ name: '@moostjs/vite', via: [], splitDeps: ['moost'] })
    expect(found.map((f) => f.name)).toContain('some-db-lib')
  })

  it('stays quiet when the consumers are inlined together with the shared package', () => {
    const found = findDevSplitPackages({
      root,
      config: {
        external: ['moost'],
        noExternal: ['@moostjs/event-http', 'some-db-lib', PLUGIN_NO_EXTERNAL],
      },
    })
    expect(found).toEqual([])
  })

  it('formats a warning naming the consumer, the inlined dep and the fix', () => {
    const message = formatDevSplitPackagesWarning([
      { name: '@moostjs/vite', via: [], splitDeps: ['moost'] },
      { name: 'some-db-lib', via: [], splitDeps: ['@moostjs/event-http'] },
    ])
    expect(message).toContain('some-db-lib depends on @moostjs/event-http (inlined)')
    expect(message).toContain("let Vite externalize 'moost', '@moostjs/event-http' in dev")
    expect(message).toContain("add 'some-db-lib' to ssr.noExternal")
    expect(message).not.toContain("add '@moostjs/vite'")
    expect(message).toContain('ssrExternalCheck: false')
  })
})
