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
    '.oxlintrc.json',
    '.oxfmtrc.json',
  ],
  // Note: .vue files are intentionally excluded — Vue's {{ }} mustache syntax
  // would conflict with ProstoRewrite's template variable replacement.
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
  const wsAddonPath = join(__dirname, '../templates/ws-addon')

  const context: Record<string, unknown> = { ...data, version }

  const excludeCommon: string[] = []

  if (!data.oxc) {
    excludeCommon.push('.oxlintrc.json')
    excludeCommon.push('.oxfmtrc.json')
  }
  if (data.type === 'ssr') {
    excludeCommon.push('tsconfig.json')
  }

  const renameFile = (filename: string) => {
    if (filename.endsWith('.jsonc')) {
      return filename.replace(/c$/, '')
    }
    return filename
  }

  const excludeTemplate: string[] = []
  if (data.type === 'ssr' && !data.ssr) {
    excludeTemplate.push('src/entry-server.ts')
  }

  await rw.rewriteDir(
    {
      baseDir: templatePath,
      output: projectDir,
      exclude: excludeTemplate,
      renameFile,
    },
    context,
  )
  await rw.rewriteDir(
    {
      baseDir: commonPath,
      output: projectDir,
      exclude: excludeCommon,
      renameFile,
    },
    context,
  )
  if (data.wf && data.type === 'http') {
    await rw.rewriteDir(
      {
        baseDir: wfPath,
        output: projectDir,
        renameFile,
      },
      context,
    )
  }
  if (data.ws && data.type === 'http') {
    await rw.rewriteDir(
      {
        baseDir: wsAddonPath,
        output: projectDir,
        renameFile,
      },
      context,
    )
  }
}

function emptyDirectorySync(directory: string) {
  if (existsSync(directory)) {
    readdirSync(directory).forEach((file) => {
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
