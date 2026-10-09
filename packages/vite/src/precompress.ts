import { existsSync } from 'node:fs'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'

const brotliAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

/**
 * Build-time precompression of the client build (`precompress` plugin option).
 * Writes `<file>.br` / `<file>.gz` siblings the production server negotiates.
 */
export interface TPrecompressOptions {
  /** Write brotli (`.br`, quality 11) siblings. Default: `true`. */
  brotli?: boolean
  /** Write gzip (`.gz`, level 9) siblings. Default: `true`. */
  gzip?: boolean
  /** Skip files smaller than this many bytes. Default: `1024`. */
  threshold?: number
  /**
   * Which files to compress, tested against the path relative to the client
   * build root. Default: text-like assets — js/mjs/cjs, css, html, svg, json,
   * webmanifest, txt, xml, wasm, ico, ttf, otf. Images and already compressed
   * formats (png, jpg, webp, woff/woff2, …) gain nothing; source maps are only
   * fetched by devtools and would dominate the build time at brotli 11.
   */
  include?: RegExp
}

export const DEFAULT_PRECOMPRESS_INCLUDE =
  /\.(?:m?js|cjs|css|html?|svg|json|webmanifest|txt|xml|wasm|ico|ttf|otf)$/i

export interface TPrecompressRunOptions extends TPrecompressOptions {
  /** Relative paths (posix separators) to leave alone. */
  exclude?: (relPath: string) => boolean
}

export interface TPrecompressStats {
  /** Source files a variant was written for. */
  files: number
  brotli: number
  gzip: number
}

/** Collects every file under `dir`, skipping dot entries except `.well-known` (as sirv serves them). */
async function collectFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') {
      continue
    }
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(abs, out)
    } else if (entry.isFile()) {
      out.push(abs)
    }
  }
  return out
}

/**
 * Writes `.br` / `.gz` siblings for the compressible files under `dir` that are
 * at least `threshold` bytes, keeping a variant only when it is smaller than the
 * original. A sibling variant at least as new as its file (e.g. from another
 * compression plugin) is left untouched; an older, stale one is replaced.
 */
export async function precompressDir(
  dir: string,
  options: TPrecompressRunOptions = {},
): Promise<TPrecompressStats> {
  const stats: TPrecompressStats = { files: 0, brotli: 0, gzip: 0 }
  const useBrotli = options.brotli !== false
  const useGzip = options.gzip !== false
  if ((!useBrotli && !useGzip) || !existsSync(dir)) {
    return stats
  }
  const threshold = options.threshold ?? 1024
  const include = options.include ?? DEFAULT_PRECOMPRESS_INCLUDE

  const files = await collectFiles(dir)
  const queue = files.filter((abs) => {
    const rel = relative(dir, abs).split(sep).join('/')
    return !/\.(?:br|gz)$/.test(rel) && include.test(rel) && !options.exclude?.(rel)
  })

  const compressFile = async (abs: string) => {
    const { size, mtimeMs } = await stat(abs)
    if (size < threshold) {
      return
    }
    const data = await readFile(abs)
    /**
     * Writes one variant. A sibling at least as new as the source was written
     * by another tool for this build and is kept; an older one is stale (an
     * earlier build into a non-emptied outDir) and is replaced — or removed
     * when the new variant would not be smaller.
     */
    const variant = async (ext: string, encode: () => Promise<Buffer>) => {
      const target = abs + ext
      const sibling = await stat(target).catch(() => undefined)
      if (sibling && sibling.mtimeMs >= mtimeMs) {
        return false
      }
      const encoded = await encode()
      if (encoded.length >= size) {
        if (sibling) {
          await rm(target)
        }
        return false
      }
      await writeFile(target, encoded)
      return true
    }
    const [br, gz] = await Promise.all([
      useBrotli &&
        variant('.br', () =>
          brotliAsync(data, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
              [constants.BROTLI_PARAM_SIZE_HINT]: size,
            },
          }),
        ),
      useGzip && variant('.gz', () => gzipAsync(data, { level: 9 })),
    ])
    stats.brotli += br ? 1 : 0
    stats.gzip += gz ? 1 : 0
    stats.files += br || gz ? 1 : 0
  }

  // zlib's async codecs run on the libuv threadpool; a small worker pool keeps
  // it busy without holding every file's buffers in memory at once.
  let next = 0
  const workers = Array.from(
    { length: Math.min(availableParallelism(), queue.length) },
    async () => {
      while (next < queue.length) {
        await compressFile(queue[next++])
      }
    },
  )
  await Promise.all(workers)
  return stats
}
