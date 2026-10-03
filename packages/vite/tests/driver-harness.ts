import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

/**
 * Shared harness of the driver-based integration specs: each runs a `*.driver.mjs`
 * scenario in a child Node process against the BUILT packages.
 */

/** Newest mtime across a source tree. */
function newestSrcMtime(dir: string): number {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    newest = Math.max(newest, entry.isDirectory() ? newestSrcMtime(abs) : statSync(abs).mtimeMs)
  }
  return newest
}

/** Throws unless each `packages/<name>/dist/index.mjs` exists and is newer than its `src`. */
export function assertFreshBuilds(names: string[]): void {
  for (const name of names) {
    const dist = fileURLToPath(new URL(`../../${name}/dist/index.mjs`, import.meta.url))
    const src = fileURLToPath(new URL(`../../${name}/src`, import.meta.url))
    if (!existsSync(dist) || statSync(dist).mtimeMs < newestSrcMtime(src)) {
      throw new Error(
        `${name}/dist is missing or older than src — run \`pnpm build ${name}\` first`,
      )
    }
  }
}

/** Runs a driver and parses the `__RESULT__ {json}` line it prints. */
export async function runDriver<T>(driver: string, args: string[], timeout: number): Promise<T> {
  const { stdout } = await promisify(execFile)('node', [driver, ...args], {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  })
  const line = stdout.split('\n').find((l) => l.startsWith('__RESULT__'))
  if (!line) {
    throw new Error(`driver produced no result. Output:\n${stdout}`)
  }
  return JSON.parse(line.slice('__RESULT__'.length)) as T
}
