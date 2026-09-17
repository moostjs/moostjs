import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  findExternalRuntimeConsumers,
  findPackageDir,
  formatExternalRuntimeConsumersWarning,
  isRuntimePackage,
  npmPackageName,
} from '../src/ssr-externals-check'

function pkg(dir: string, name: string, extra: Record<string, unknown> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...extra }))
}

describe('npmPackageName', () => {
  it('extracts bare and scoped package names, stripping subpaths', () => {
    expect(npmPackageName('vue')).toBe('vue')
    expect(npmPackageName('vue/server-renderer')).toBe('vue')
    expect(npmPackageName('@wooksjs/event-http')).toBe('@wooksjs/event-http')
    expect(npmPackageName('@atscript/typescript/utils')).toBe('@atscript/typescript')
  })

  it('ignores relative, absolute, virtual, and builtin specifiers', () => {
    expect(npmPackageName('./chunk.js')).toBeUndefined()
    expect(npmPackageName('/abs/path.js')).toBeUndefined()
    expect(npmPackageName('\0virtual:vite-id')).toBeUndefined()
    expect(npmPackageName('virtual:uno.css')).toBeUndefined()
    expect(npmPackageName('node:fs')).toBeUndefined()
    expect(npmPackageName('fs')).toBeUndefined()
    expect(npmPackageName('path/posix')).toBeUndefined()
    expect(npmPackageName('@scope')).toBeUndefined()
    expect(npmPackageName('')).toBeUndefined()
  })
})

describe('isRuntimePackage', () => {
  it('matches the moost/wooks runtime packages only', () => {
    for (const name of ['moost', 'moost/sub', '@moostjs/vite', '@wooksjs/event-core', 'wooks']) {
      expect(isRuntimePackage(name)).toBe(true)
    }
    for (const name of ['moostify', 'wooksy', 'vue', '@atscript/core']) {
      expect(isRuntimePackage(name)).toBe(false)
    }
  })
})

describe('findExternalRuntimeConsumers', () => {
  let root: string

  beforeAll(() => {
    // realpath: macOS tmpdir is a symlink (/var → /private/var) and findPackageDir returns realpaths
    root = realpathSync(mkdtempSync(join(tmpdir(), 'moost-vite-ext-')))
    const nm = join(root, 'node_modules')
    pkg(root, 'app')

    // direct external that calls wooks composables
    pkg(join(nm, 'some-auth-lib'), 'some-auth-lib', {
      dependencies: { '@wooksjs/event-http': '^0.7.0', 'leaf-lib': '^1.0.0' },
    })
    // leaf with no runtime dep
    pkg(join(nm, 'leaf-lib'), 'leaf-lib')
    // peer-dep consumer
    pkg(join(nm, 'peer-consumer'), 'peer-consumer', { peerDependencies: { moost: '*' } })
    // npm-style nested transitive consumer
    pkg(join(nm, 'wrapper-lib'), 'wrapper-lib', { dependencies: { 'inner-consumer': '^1.0.0' } })
    pkg(join(nm, 'wrapper-lib', 'node_modules', 'inner-consumer'), 'inner-consumer', {
      dependencies: { '@wooksjs/event-core': '^0.7.0' },
    })
    // pnpm-style layout: symlinked root entry, deps as siblings in the store dir
    const store = join(nm, '.pnpm', 'pnpm-lib@1.0.0', 'node_modules')
    pkg(join(store, 'pnpm-lib'), 'pnpm-lib', { dependencies: { 'pnpm-inner': '^1.0.0' } })
    pkg(join(store, 'pnpm-inner'), 'pnpm-inner', { dependencies: { wooks: '^0.7.0' } })
    symlinkSync(join(store, 'pnpm-lib'), join(nm, 'pnpm-lib'), 'dir')
    // scoped consumer, imported through a subpath
    pkg(join(nm, '@acme', 'db'), '@acme/db', { dependencies: { '@moostjs/event-http': '*' } })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('flags a direct external that depends on the runtime', () => {
    const found = findExternalRuntimeConsumers({ root, externalIds: ['some-auth-lib'] })
    expect(found).toEqual([
      { name: 'some-auth-lib', via: [], runtimeDeps: ['@wooksjs/event-http'] },
    ])
  })

  it('treats peerDependencies on the runtime as consumption', () => {
    const found = findExternalRuntimeConsumers({ root, externalIds: ['peer-consumer'] })
    expect(found.map((f) => f.name)).toEqual(['peer-consumer'])
  })

  it('ignores leaf packages, builtins, relative chunks, and the runtime itself', () => {
    const found = findExternalRuntimeConsumers({
      root,
      externalIds: ['leaf-lib', 'node:fs', 'path', './assets/chunk.js', '@wooksjs/event-http'],
    })
    expect(found).toEqual([])
  })

  it('walks nested (npm-style) transitive dependencies of an external', () => {
    const found = findExternalRuntimeConsumers({ root, externalIds: ['wrapper-lib'] })
    expect(found).toEqual([
      { name: 'inner-consumer', via: ['wrapper-lib'], runtimeDeps: ['@wooksjs/event-core'] },
    ])
  })

  it('walks pnpm-style symlinked layouts through the store directory', () => {
    const found = findExternalRuntimeConsumers({ root, externalIds: ['pnpm-lib'] })
    expect(found).toEqual([{ name: 'pnpm-inner', via: ['pnpm-lib'], runtimeDeps: ['wooks'] }])
  })

  it('maps subpath imports to their package and skips packages that are not installed', () => {
    const found = findExternalRuntimeConsumers({
      root,
      externalIds: ['@acme/db/adapters', 'not-installed-lib'],
    })
    expect(found.map((f) => f.name)).toEqual(['@acme/db'])
  })

  it('reports each package once even when imported via several specifiers', () => {
    const found = findExternalRuntimeConsumers({
      root,
      externalIds: ['some-auth-lib', 'some-auth-lib/strategies', 'some-auth-lib'],
    })
    expect(found).toHaveLength(1)
  })

  it('resolves package dirs Node-style, walking up from nested locations', () => {
    expect(findPackageDir('leaf-lib', join(root, 'node_modules', 'wrapper-lib'))).toBe(
      join(root, 'node_modules', 'leaf-lib'),
    )
    expect(findPackageDir('nope', root)).toBeUndefined()
  })
})

describe('formatExternalRuntimeConsumersWarning', () => {
  it('names each offender, its chain, and the direct externals to fix', () => {
    const msg = formatExternalRuntimeConsumersWarning([
      { name: 'some-auth-lib', via: [], runtimeDeps: ['@wooksjs/event-http'] },
      { name: 'inner-consumer', via: ['wrapper-lib'], runtimeDeps: ['@wooksjs/event-core'] },
    ])
    expect(msg).toContain('some-auth-lib depends on @wooksjs/event-http')
    expect(msg).toContain(
      'inner-consumer (loaded via external wrapper-lib) depends on @wooksjs/event-core',
    )
    expect(msg).toContain("add 'some-auth-lib', 'wrapper-lib' to ssr.noExternal")
    expect(msg).toContain('ssrExternalCheck: false')
  })
})
