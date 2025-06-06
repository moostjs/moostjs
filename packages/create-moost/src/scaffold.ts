/* eslint-disable unicorn/import-style */
import { ProstoRewrite } from '@prostojs/rewrite'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
} from 'fs'
import { join } from 'path'

import type { TPrompts } from './types'

const rw = new ProstoRewrite({
  textPattern: [
    '*.{js,jsx,ts,tsx,txt,json,jsonc,yml,yaml,md,ini,css,html}',
    'Dockerfile',
    '*config',
    '.gitignore',
    '.eslintrc.json',
    '.prettierignore',
    '.prettierrc',
  ],
})
const root = process.cwd()

const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json')).toString()) as {
  version: string
}

export async function scaffold(data: TPrompts) {
  const projectDir = join(root, data.targetDir)
  if (existsSync(projectDir)) {
    if (data.overwrite) {
      emptyDirectorySync(projectDir)
    }
  } else {
    mkdirSync(projectDir)
  }
  const templatePath = join(__dirname, '../templates', data.type)
  const commonPath = join(__dirname, '../templates/common')
  const wfPath = join(__dirname, '../templates/wf')

  const context: Record<string, unknown> = { ...data, version }

  const excludeCommon: string[] = []

  if (!data.domelint) {
    excludeCommon.push('.domelintrc.yml')
  }

  await rw.rewriteDir(
    {
      baseDir: templatePath,
      output: projectDir,
      renameFile(filename) {
        if (filename.endsWith('.jsonc')) {
          return filename.replace(/c$/, '')
        }
        return filename
      },
    },
    context
  )
  await rw.rewriteDir(
    {
      baseDir: commonPath,
      output: projectDir,
      exclude: excludeCommon,
      renameFile(filename) {
        if (filename.endsWith('.jsonc')) {
          return filename.replace(/c$/, '')
        }
        return filename
      },
    },
    context
  )
  if (data.wf) {
    await rw.rewriteDir(
      {
        baseDir: wfPath,
        output: projectDir,
        renameFile(filename) {
          if (filename.endsWith('.jsonc')) {
            return filename.replace(/c$/, '')
          }
          return filename
        },
      },
      context
    )
  }
}

function emptyDirectorySync(directory: string) {
  if (existsSync(directory)) {
    readdirSync(directory).forEach(file => {
      const currentPath = join(directory, file)

      if (lstatSync(currentPath).isDirectory()) {
        // Recurse if the current path is a directory
        emptyDirectorySync(currentPath)
        rmdirSync(currentPath) // Remove the empty directory
      } else {
        // Delete file
        unlinkSync(currentPath)
      }
    })
  }
}
