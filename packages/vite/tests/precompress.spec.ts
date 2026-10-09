import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import type { Plugin } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { moostVite } from '../src/moost-vite'
import type { TMoostViteDevOptions } from '../src/moost-vite'
import { precompressDir } from '../src/precompress'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const BIG_TEXT = 'const answer = 42; // compressible\n'.repeat(200)

/** A fake client build: compressible, tiny, binary and hidden files. */
function makeClientDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'moost-precompress-'))
  dirs.push(dir)
  const files: Record<string, string | Buffer> = {
    'index.html': `<html><body>${'<p>shell</p>'.repeat(200)}</body></html>`,
    'assets/app-abc123.js': BIG_TEXT,
    'assets/style-def456.css': 'body { color: red; }\n'.repeat(100),
    'assets/logo-123.svg': `<svg>${'<path d="M0 0L10 10"/>'.repeat(100)}</svg>`,
    'assets/tiny-1.js': 'export const a = 1\n'.repeat(20), // 400 bytes
    'assets/photo-1.png': Buffer.from(BIG_TEXT),
    'assets/font-1.woff2': Buffer.from(BIG_TEXT),
    'assets/noise-1.js': randomBytes(4096),
    'robots.txt': 'User-agent: *\nDisallow:\n'.repeat(80), // a public/ copy
    'assets/app-abc123.js.map': JSON.stringify({ mappings: BIG_TEXT }),
    '.vite/ssr-manifest.json': JSON.stringify({ big: BIG_TEXT }),
  }
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  return dir
}

describe('precompressDir', () => {
  it('writes .br and .gz siblings that decode to the original', async () => {
    const dir = makeClientDir()
    const stats = await precompressDir(dir)

    for (const rel of [
      'index.html',
      'assets/app-abc123.js',
      'assets/style-def456.css',
      'assets/logo-123.svg',
      'robots.txt',
    ]) {
      const original = readFileSync(join(dir, rel))
      const br = readFileSync(join(dir, `${rel}.br`))
      const gz = readFileSync(join(dir, `${rel}.gz`))
      expect(br.length).toBeLessThan(original.length)
      expect(brotliDecompressSync(br).equals(original)).toBe(true)
      expect(gunzipSync(gz).equals(original)).toBe(true)
    }
    expect(stats).toEqual({ files: 5, brotli: 5, gzip: 5 })
  })

  it('skips small, binary, already-compressed, incompressible and hidden files', async () => {
    const dir = makeClientDir()
    await precompressDir(dir)
    for (const rel of [
      'assets/tiny-1.js', // below the 1 KiB threshold
      'assets/photo-1.png', // images are not included
      'assets/font-1.woff2', // already compressed format
      'assets/noise-1.js', // a variant would not be smaller
      'assets/app-abc123.js.map', // source maps: devtools only
      '.vite/ssr-manifest.json', // not served (dot directory)
    ]) {
      const written = [`${rel}.br`, `${rel}.gz`].filter((file) => existsSync(join(dir, file)))
      expect(written).toEqual([])
    }
  })

  it('honours brotli/gzip/threshold/include/exclude', async () => {
    const dir = makeClientDir()
    await precompressDir(dir, {
      gzip: false,
      threshold: 1,
      include: /\.js$/,
      exclude: (rel) => rel === 'assets/app-abc123.js',
    })
    expect(existsSync(join(dir, 'assets/tiny-1.js.br'))).toBe(true)
    expect(existsSync(join(dir, 'assets/tiny-1.js.gz'))).toBe(false)
    expect(existsSync(join(dir, 'assets/app-abc123.js.br'))).toBe(false)
    expect(existsSync(join(dir, 'assets/style-def456.css.br'))).toBe(false)
  })

  it('leaves variants written by another tool untouched', async () => {
    const dir = makeClientDir()
    writeFileSync(join(dir, 'assets/app-abc123.js.br'), 'EXISTING')
    await precompressDir(dir)
    expect(readFileSync(join(dir, 'assets/app-abc123.js.br'), 'utf8')).toBe('EXISTING')
    expect(existsSync(join(dir, 'assets/app-abc123.js.gz'))).toBe(true)
  })
})

describe('precompressDir — stale variants', () => {
  /** Backdates a file, as if an earlier build into the same outDir wrote it. */
  const backdate = (file: string) => utimesSync(file, new Date(0), new Date(0))

  it('replaces a variant older than its file', async () => {
    const dir = makeClientDir()
    const stale = join(dir, 'index.html.br')
    writeFileSync(stale, 'STALE')
    backdate(stale)
    await precompressDir(dir)
    expect(
      brotliDecompressSync(readFileSync(stale)).equals(readFileSync(join(dir, 'index.html'))),
    ).toBe(true)
  })

  it('removes a stale variant the new content does not beat', async () => {
    const dir = makeClientDir()
    const stale = join(dir, 'assets/noise-1.js.gz')
    writeFileSync(stale, 'STALE')
    backdate(stale)
    await precompressDir(dir)
    expect(existsSync(stale)).toBe(false)
  })
})

/** Runs the plugin's `buildApp` hook against a fake builder whose client env wrote `dir`. */
async function runBuildAppHook(dir: string, options: Partial<TMoostViteDevOptions>) {
  const [plugin] = moostVite({ entry: './src/main.ts', middleware: true, ...options }) as Plugin[]
  const hook = plugin.buildApp as { order: string; handler: Function }
  expect(hook.order).toBe('post')
  const info = vi.fn()
  await hook.handler({
    environments: {
      client: {
        isBuilt: true,
        config: { root: dir, build: { outDir: '.', write: true } },
        logger: { info },
      },
    },
  })
  return info
}

describe('moostVite precompress build step', () => {
  it('precompresses the client build after buildApp by default', async () => {
    const dir = makeClientDir()
    const info = await runBuildAppHook(dir, {})
    expect(existsSync(join(dir, 'assets/app-abc123.js.br'))).toBe(true)
    expect(existsSync(join(dir, 'index.html.gz'))).toBe(true)
    expect(info).toHaveBeenCalledWith(expect.stringContaining('precompressed 5 client files'))
  })

  it('leaves the SSR template index.html alone', async () => {
    const dir = makeClientDir()
    await runBuildAppHook(dir, { ssrEntry: '/src/entry-server.ts' })
    expect(existsSync(join(dir, 'assets/app-abc123.js.br'))).toBe(true)
    expect(existsSync(join(dir, 'index.html.br'))).toBe(false)
  })

  it('does nothing with `precompress: false` or outside middleware mode', async () => {
    const dir = makeClientDir()
    await runBuildAppHook(dir, { precompress: false })
    await runBuildAppHook(dir, { middleware: false })
    expect(existsSync(join(dir, 'assets/app-abc123.js.br'))).toBe(false)
    expect(existsSync(join(dir, 'assets/app-abc123.js.gz'))).toBe(false)
  })

  it('passes options through', async () => {
    const dir = makeClientDir()
    await runBuildAppHook(dir, { precompress: { brotli: false } })
    expect(existsSync(join(dir, 'assets/app-abc123.js.br'))).toBe(false)
    expect(existsSync(join(dir, 'assets/app-abc123.js.gz'))).toBe(true)
  })
})
