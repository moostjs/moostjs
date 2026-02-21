import { existsSync, readdirSync } from 'fs'
import prompts from 'prompts'

import type { TInputs, TPrompts } from './types'

const defaultProjectName = 'moost-app'

export async function getPrompts(inputs: Partial<TInputs>): Promise<TPrompts> {
  const predefined: Partial<TPrompts> = {
    targetDir: inputs.name || '',
    projectName: inputs.name || '',
    packageName: inputs.name || '',
  }
  try {
    const results = await prompts<keyof TPrompts | 'overwriteChecker'>(
      [
        {
          name: 'projectName',
          type: predefined.targetDir ? null : 'text',
          message: 'Project name:',
          initial: defaultProjectName,
          onState: (state: { value: string }) =>
            (predefined.targetDir = String(state.value).trim() || defaultProjectName),
        },
        {
          name: 'overwrite',
          type: () => (canSkipEmptying(predefined.targetDir!) || inputs.force ? null : 'confirm'),
          message: () => {
            const dirForPrompt =
              predefined.targetDir === '.'
                ? 'Current directory'
                : `Target directory "${predefined.targetDir!}"`

            return `${dirForPrompt} is not empty. Remove existing files and continue?`
          },
        },
        {
          name: 'overwriteChecker',
          type: (prev, values) => {
            if (values.overwrite === false) {
              throw new Error('Operation cancelled')
            }
            return null
          },
        },
        {
          name: 'type',
          type: () => {
            if (inputs.cli && !inputs.http) {
              predefined.type = 'cli'
              return null
            }
            if (!inputs.cli && inputs.http) {
              predefined.type = 'http'
              return null
            }
            return 'select'
          },
          message: 'Moost Adapter:',
          choices: [
            { title: 'HTTP (Web) Application', value: 'http' },
            { title: 'CLI Application', value: 'cli' },
          ],
        },
        {
          name: 'packageName',
          type: () => (isValidPackageName(predefined.targetDir!) ? null : 'text'),
          message: 'Package name:',
          initial: () => toValidPackageName(predefined.targetDir!),
          validate: (dir: string) => isValidPackageName(dir) || 'Invalid package.json name',
        },
        {
          name: 'wf',
          type: (prev, values) =>
            inputs.wf || values.type === 'cli' || inputs.cli ? null : 'toggle',
          message: 'Add Moost Workflows Example?',
          initial: false,
          active: 'Yes',
          inactive: 'No',
        },
        {
          name: 'domelint',
          type: () => (inputs.domelint ? null : 'toggle'),
          message: 'Add do-me-lint (smart eslint installer)?',
          initial: false,
          active: 'Yes',
          inactive: 'No',
        },
      ],
      {
        onCancel: () => {
          throw new Error('Operation cancelled')
        },
      },
    )
    return {
      ...predefined,
      ...results,
      packageName: (results.packageName || results.targetDir || predefined.targetDir) as string,
    }
  } catch (error) {
    console.log((error as Error).message)
    process.exit(1)
  }
}

function canSkipEmptying(dir: string) {
  if (!existsSync(dir)) {
    return true
  }

  const files = readdirSync(dir)
  if (files.length === 0) {
    return true
  }
  if (files.length === 1 && files[0] === '.git') {
    return true
  }

  return false
}

function isValidPackageName(projectName: string) {
  return /^(?:@[\d*a-z~-][\d*._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*$/.test(projectName)
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replaceAll(/[^\da-z~-]+/g, '-')
}
