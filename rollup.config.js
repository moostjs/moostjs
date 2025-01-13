import { readdirSync, rmSync, statSync } from 'node:fs'

import { dye } from '@prostojs/dye'
import commonJS from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import { createRequire } from 'module'
import { dts } from 'rollup-plugin-dts'
import typescript from 'rollup-plugin-typescript2'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const target = process.env.TARGET

const dyeModifiers = [
  'dim',
  'bold',
  'underscore',
  'inverse',
  'italic',
  'crossed',
  'gray01',
  'gray02',
  'gray03',
]
const dyeColors = ['red', 'green', 'cyan', 'blue', 'yellow', 'white', 'magenta', 'black']

const external = ['url', 'crypto', 'stream', 'packages/*/src', 'http', 'path']

const replacePlugin = replace({
  values: {
    __VERSION__: JSON.stringify(pkg.version),
    __PROJECT__: JSON.stringify(process.env.PROJECT),
    ...createDyeReplaceConst(),
  },
  preventAssignment: true,
})

const targets = readdirSync('packages').filter(f => {
  if (f !== target) {
    return false
  }
  if (!statSync(`packages/${f}`).isDirectory()) {
    return false
  }
  const pkg = require(`./packages/${f}/package.json`)
  if (pkg.private) {
    return false
  }
  const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]
  deps.length > 0 && external.push(...deps)
  rmSync(`./packages/${f}/dist`, { recursive: true, force: true })
  return true
})

const configs = targets.flatMap(target => [
  createConfig(target, 'mjs'),
  createConfig(target, 'cjs'),
  createDtsConfig(target),
])

function createConfig(target, type) {
  const formats = {
    cjs: 'cjs',
    mjs: 'es',
  }
  return {
    external,
    input: `./packages/${target}/src/index.ts`,
    output: {
      // dir: `./packages/${target}/dist`,
      file: `./packages/${target}/dist/index.${type}`,
      format: formats[type],
      sourcemap: false,
    },
    plugins: [
      commonJS({ sourceMap: false }),
      nodeResolve(),
      typescript({
        check: true,
        tsconfig: './tsconfig.json',
        tsconfigOverride: {
          target: 'es2020',
          declaration: false,
          declarationMap: false,
          removeComments: true,
          include: ['packages/*/src', 'packages/*/__tests__', 'common/*.ts'],
          exclude: ['**/__tests__', '*.spec.ts', 'explorations'],
        },
      }),
      replacePlugin,
    ],
  }
}

function createDtsConfig(target) {
  return {
    external,
    input: `./packages/${target}/src/index.ts`,
    output: {
      file: `./packages/${target}/dist/index.d.ts`,
      format: 'es',
      sourcemap: false,
    },
    plugins: [
      dts({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          removeComments: false,
        },
      }),
    ],
  }
}

export default configs

function createDyeReplaceConst() {
  const c = dye('red')
  const bg = dye('bg-red')
  const dyeReplacements = {
    __DYE_RESET__: `'${dye.reset}'`,
    __DYE_COLOR_OFF__: `'${c.close}'`,
    __DYE_BG_OFF__: `'${bg.close}'`,
  }
  dyeModifiers.forEach(v => {
    dyeReplacements[`__DYE_${v.toUpperCase()}__`] = `'${dye(v).open}'`
    dyeReplacements[`__DYE_${v.toUpperCase()}_OFF__`] = `'${dye(v).close}'`
  })
  dyeColors.forEach(v => {
    dyeReplacements[`__DYE_${v.toUpperCase()}__`] = `'${dye(v).open}'`
    dyeReplacements[`__DYE_BG_${v.toUpperCase()}__`] = `'${dye(`bg-${v}`).open}'`
    dyeReplacements[`__DYE_${v.toUpperCase()}_BRIGHT__`] = `'${dye(`${v}-bright`).open}'`
    dyeReplacements[`__DYE_BG_${v.toUpperCase()}_BRIGHT__`] = `'${dye(`bg-${v}-bright`).open}'`
  })
  return dyeReplacements
}
