#!/usr/bin/env

import 'zx/globals'
import { getBuildOptions, getExternals, getWorkspaceFolders } from './utils.js'
import { dye } from '@prostojs/dye'
import { rollup } from 'rollup'
import { rolldown } from 'rolldown'
import dyePlugin from '@prostojs/dye/rolldown'
import dtsPlugin from 'rollup-plugin-dts'
import { writeFileSync } from 'fs'
import pkg from '../package.json' assert { type: 'json' }
import path from 'path'
import swcPlugin from 'unplugin-swc'

const swc = swcPlugin.rolldown()
const _dye = dyePlugin()

let i = 1

const info = dye('blue').attachConsole()
const step = dye('cyan')
  .prefix(() => `\n${i++}. `)
  .attachConsole()
const done = dye('green')
  .prefix(() => ` ✅ `)
  .attachConsole()
const file = dye('blue', 'bold')

const target = process.argv[2]

// $.verbose = true
const workspaces = target ? getWorkspaceFolders().filter(t => t === target) : getWorkspaceFolders()
if (!workspaces.length) {
  console.error(`No workspaces found`)
  process.exit(1)
}
const externals = new Map()
for (const ws of workspaces) {
  externals.set(ws, getExternals(ws))
}

async function run() {
  console.log()
  let types = true
  if (target) {
    info(`Target: ${dye('bold')(target)}`)
    console.log()
    types = false
    for (const build of getBuildOptions(target)) {
      if (build.dts !== false) {
        types = true
        break
      }
    }
  }
  if (types) {
    await generateTypes()
  }
  await generateBundles()
}
run()

async function generateTypes() {
  step('Generating Types')
  await $`npx tsc`.nothrow()

  for (const ws of workspaces) {
    const builds = getBuildOptions(ws)
    for (const { entries, dts } of builds) {
      if (!dts) {
        continue
      }
      for (const entry of entries) {
        const p = entry.split('/').slice(0, -1).join('/')
        const source = path.join('./.types', ws, p)
        const target = path.join('./packages', ws, 'dist', p)
        await $`mkdir -p ./packages/${ws}/dist && rsync -a ${source}/ ${target}/ --delete`
      }
    }
  }
  for (const ws of workspaces) {
    await rollupTypes(ws)
  }

  await $`rm -rf ./.types`
}

const FORMATS = {
  esm: {
    ext: '.mjs',
    format: 'esm',
  },
  cjs: {
    ext: '.cjs',
    format: 'cjs',
  },
}

async function rollupTypes(ws) {
  const builds = getBuildOptions(ws)
  const files = []
  for (const { entries, dts } of builds) {
    if (!dts) {
      continue
    }
    for (const entry of entries) {
      const fileName = entry
        .split('/')
        .pop()
        .replace(/\.\w+$/u, '')
      const p = entry.split('/').slice(0, -1).join('/')
      const input = path.join('packages', ws, 'dist', p, `${fileName}.d.ts`)
      const inputOptions = {
        input,
        plugins: [dtsPlugin()],
        external: externals.get(ws),
      }
      const bundle = await rollup(inputOptions)
      const { output } = await bundle.generate({ format: FORMATS.esm.format })
      const target = `./packages/${ws}/dist/${fileName}.d.ts`
      files.push({
        name: target,
        code: output[0].code,
      })
    }
  }
  await $`rm -rf ./packages/${ws}/dist`
  await $`mkdir -p ./packages/${ws}/dist`
  for (const f of files) {
    writeFileSync(f.name, f.code)
    done(`Created ${file(f.name)}`)
  }
}

async function generateBundles() {
  step('Rolldown Bundles')
  for (const ws of workspaces) {
    rolldownPackages(ws)
  }
}

async function rolldownPackages(ws) {
  const builds = getBuildOptions(ws)
  for (const { entries, formats, external } of builds) {
    for (const entry of entries) {
      const inputOptions = {
        input: path.join(`packages/${ws}`, entry),
        external: external || externals.get(ws),
        define: {
          __VERSION__: JSON.stringify(pkg.version),
        },
        plugins: [_dye, swc],
      }
      const fileName = entry
        .split('/')
        .pop()
        .replace(/\.\w+$/u, '')
      const bundle = await rolldown(inputOptions)
      const created = []
      for (const f of formats) {
        const { ext, format } = FORMATS[f]
        const { output } = await bundle.generate({ format })
        const target = `./packages/${ws}/dist/${fileName}${ext}`
        writeFileSync(target, output[0].code)
        created.push(target)
      }
      done(created.join(' \t'))
    }
  }
}
