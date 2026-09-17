import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bundledPackagesFromModuleIds,
  compilePackagePatterns,
  findPackageDir,
  findSplitPackages,
  formatSplitPackagesWarning,
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
  it('matches the moost/wooks runtime packages only (the guard scope)', () => {
    for (const name of ['moost', 'moost/sub', '@moostjs/vite', '@wooksjs/event-core', 'wooks']) {
      expect(isRuntimePackage(name)).toBe(true)
    }
    for (const name of ['moostify', 'wooksy', 'vue', '@atscript/core']) {
      expect(isRuntimePackage(name)).toBe(false)
    }
  })
})

describe('compilePackagePatterns', () => {
  const matches = (patterns: RegExp[], name: string) => patterns.some((re) => re.test(name))

  it('watches the moost/wooks runtime and the @atscript family by default', () => {
    const patterns = compilePackagePatterns()
    for (const name of ['moost', '@moostjs/event-http', 'wooks', '@wooksjs/event-core']) {
      expect(matches(patterns, name)).toBe(true)
    }
    expect(matches(patterns, '@atscript/db')).toBe(true)
    expect(matches(patterns, '@atscript/typescript')).toBe(true)
    expect(matches(patterns, 'lodash')).toBe(false)
    expect(matches(patterns, '@acme/db')).toBe(false)
  })

  it('adds exact package names, scope prefixes and RegExps', () => {
    const patterns = compilePackagePatterns(['lodash', '@acme/', /^my-lib-/])
    expect(matches(patterns, 'lodash')).toBe(true)
    expect(matches(patterns, 'lodash.merge')).toBe(false)
    expect(matches(patterns, '@acme/db')).toBe(true)
    expect(matches(patterns, '@acme/ui')).toBe(true)
    expect(matches(patterns, '@acmex/db')).toBe(false)
    expect(matches(patterns, 'my-lib-core')).toBe(true)
    expect(matches(patterns, 'other-lib')).toBe(false)
    // defaults are kept
    expect(matches(patterns, '@wooksjs/event-http')).toBe(true)
  })

  it('escapes regex metacharacters in string entries', () => {
    const patterns = compilePackagePatterns(['lodash.merge'])
    expect(matches(patterns, 'lodash.merge')).toBe(true)
    expect(matches(patterns, 'lodashXmerge')).toBe(false)
  })
})

describe('bundledPackagesFromModuleIds', () => {
  it('derives package names from node_modules module ids', () => {
    const found = bundledPackagesFromModuleIds([
      '/app/node_modules/some-lib/dist/index.js',
      '/app/node_modules/@acme/db/dist/index.mjs',
      '/app/node_modules/.pnpm/@atscript+db@0.1.127_abc/node_modules/@atscript/db/dist/index.mjs',
      '/app/node_modules/.pnpm/wooks@0.7.23/node_modules/wooks/dist/index.mjs',
      // nested npm layout — the LAST node_modules wins
      '/app/node_modules/wrapper-lib/node_modules/inner-lib/index.js',
      String.raw`C:\app\node_modules\win-lib\dist\index.js`,
    ])
    expect([...found].toSorted()).toEqual([
      '@acme/db',
      '@atscript/db',
      'inner-lib',
      'some-lib',
      'win-lib',
      'wooks',
    ])
  })

  it('ignores virtual ids, app sources and empty ids', () => {
    const found = bundledPackagesFromModuleIds([
      '\0virtual:moost-vite-entry',
      '\0/app/node_modules/some-lib/index.js',
      '/app/src/main.ts',
      '/app/src/controllers/app.controller.ts',
      '',
    ])
    expect([...found]).toEqual([])
  })
})

describe('findSplitPackages', () => {
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
    // adapter that is itself a watched package and depends on another watched package
    const ats = join(nm, '@atscript')
    pkg(join(ats, 'db-mysql'), '@atscript/db-mysql', { dependencies: { '@atscript/db': '*' } })
    // …installed too, so a walk that descended into it would report it as well
    pkg(join(ats, 'db'), '@atscript/db', { dependencies: { '@atscript/core': '*' } })
    // consumers of packages nobody watches by default
    pkg(join(nm, 'lodash-consumer'), 'lodash-consumer', { dependencies: { lodash: '^4.0.0' } })
    pkg(join(nm, 'acme-consumer'), 'acme-consumer', { dependencies: { '@acme/db': '*' } })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const split = (externalIds: string[], bundled: string[], patterns?: RegExp[]) =>
    findSplitPackages({ root, externalIds, bundledPackages: new Set(bundled), patterns })

  it('flags a direct external that depends on a bundled runtime package', () => {
    expect(split(['some-auth-lib'], ['@wooksjs/event-http'])).toEqual([
      { name: 'some-auth-lib', via: [], splitDeps: ['@wooksjs/event-http'] },
    ])
  })

  it('stays quiet when the shared dep is external too (nothing is split)', () => {
    expect(split(['some-auth-lib'], ['vue'])).toEqual([])
  })

  it('treats peerDependencies on a bundled package as consumption', () => {
    expect(split(['peer-consumer'], ['moost']).map((f) => f.name)).toEqual(['peer-consumer'])
  })

  it('ignores leaf packages, builtins, relative chunks, and uninstalled externals', () => {
    const ids = ['leaf-lib', 'node:fs', 'path', './assets/chunk.js', '@wooksjs/event-http']
    expect(split(ids, ['@wooksjs/event-http', '@wooksjs/event-core'])).toEqual([])
  })

  it('flags an external that is itself a watched package (adapter → bundled core)', () => {
    expect(split(['@atscript/db-mysql'], ['@atscript/db'])).toEqual([
      { name: '@atscript/db-mysql', via: [], splitDeps: ['@atscript/db'] },
    ])
  })

  it('does not descend into a bundled (split) dependency', () => {
    // `@atscript/db` is installed and depends on the bundled `@atscript/core`, but Node
    // loads it from the external adapter's tree — the adapter is the one to fix.
    const found = split(['@atscript/db-mysql'], ['@atscript/db', '@atscript/core'])
    expect(found.map((f) => f.name)).toEqual(['@atscript/db-mysql'])
  })

  it('ignores packages nobody watches unless they are passed in `patterns`', () => {
    expect(split(['lodash-consumer'], ['lodash'])).toEqual([])
    expect(split(['lodash-consumer'], ['lodash'], compilePackagePatterns(['lodash']))).toEqual([
      { name: 'lodash-consumer', via: [], splitDeps: ['lodash'] },
    ])
  })

  it('honors scope-prefix and RegExp entries in `patterns`', () => {
    expect(split(['acme-consumer'], ['@acme/db'])).toEqual([])
    for (const extra of [['@acme/'], [/^@acme\//]]) {
      expect(split(['acme-consumer'], ['@acme/db'], compilePackagePatterns(extra))).toEqual([
        { name: 'acme-consumer', via: [], splitDeps: ['@acme/db'] },
      ])
    }
  })

  it('walks nested (npm-style) transitive dependencies of an external', () => {
    expect(split(['wrapper-lib'], ['@wooksjs/event-core'])).toEqual([
      { name: 'inner-consumer', via: ['wrapper-lib'], splitDeps: ['@wooksjs/event-core'] },
    ])
  })

  it('walks pnpm-style symlinked layouts through the store directory', () => {
    expect(split(['pnpm-lib'], ['wooks'])).toEqual([
      { name: 'pnpm-inner', via: ['pnpm-lib'], splitDeps: ['wooks'] },
    ])
  })

  it('maps subpath imports to their package and skips packages that are not installed', () => {
    const found = split(['@acme/db/adapters', 'not-installed-lib'], ['@moostjs/event-http'])
    expect(found.map((f) => f.name)).toEqual(['@acme/db'])
  })

  it('reports each package once even when imported via several specifiers', () => {
    const ids = ['some-auth-lib', 'some-auth-lib/strategies', 'some-auth-lib']
    expect(split(ids, ['@wooksjs/event-http'])).toHaveLength(1)
  })

  it('resolves package dirs Node-style, walking up from nested locations', () => {
    expect(findPackageDir('leaf-lib', join(root, 'node_modules', 'wrapper-lib'))).toBe(
      join(root, 'node_modules', 'leaf-lib'),
    )
    expect(findPackageDir('nope', root)).toBeUndefined()
  })
})

describe('findSplitPackages traversal limit', () => {
  let root: string
  const DEPTH = 5100 // > MAX_VISITED (5000)

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'moost-vite-deep-')))
    const nm = join(root, 'node_modules')
    pkg(root, 'app')
    // one long chain; only the very last link depends on the bundled package
    for (let i = 0; i < DEPTH; i++) {
      const dep = i === DEPTH - 1 ? '@wooksjs/event-http' : `chain-${i + 1}`
      pkg(join(nm, `chain-${i}`), `chain-${i}`, { dependencies: { [dep]: '*' } })
    }
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('stops walking after MAX_VISITED packages', () => {
    const found = findSplitPackages({
      root,
      externalIds: ['chain-0'],
      bundledPackages: new Set(['@wooksjs/event-http']),
    })
    expect(found).toEqual([])
  })
})

describe('formatSplitPackagesWarning', () => {
  it('names each offender, its chain, and the direct externals to fix', () => {
    const msg = formatSplitPackagesWarning([
      { name: 'some-auth-lib', via: [], splitDeps: ['@wooksjs/event-http'] },
      { name: 'inner-consumer', via: ['wrapper-lib'], splitDeps: ['@wooksjs/event-core'] },
      { name: '@atscript/db-mysql', via: [], splitDeps: ['@atscript/db'] },
    ])
    expect(msg).toContain('some-auth-lib depends on @wooksjs/event-http (bundled)')
    expect(msg).toContain(
      'inner-consumer (loaded via external wrapper-lib) depends on @wooksjs/event-core (bundled)',
    )
    expect(msg).toContain('@atscript/db-mysql depends on @atscript/db (bundled)')
    expect(msg).toContain(
      "add 'some-auth-lib', 'wrapper-lib', '@atscript/db-mysql' to ssr.noExternal",
    )
    expect(msg).toContain('externalize the whole family')
    expect(msg).toContain('ssrExternalCheck: false')
    expect(msg).toContain('ssrExternalCheck: { packages: [...] }')
  })

  it('deduplicates the direct externals named in the fix', () => {
    const msg = formatSplitPackagesWarning([
      { name: 'inner-a', via: ['wrapper-lib'], splitDeps: ['moost'] },
      { name: 'inner-b', via: ['wrapper-lib', 'inner-a'], splitDeps: ['moost'] },
    ])
    expect(msg).toContain("add 'wrapper-lib' to ssr.noExternal")
  })
})
