export interface TInputs {
  name: string
  http: boolean
  cli: boolean
  ws: boolean
  wf: boolean
  oxc: boolean
  force: boolean
}

export interface TPrompts {
  targetDir: string
  projectName: string
  packageName: string
  type: 'cli' | 'http' | 'ws'
  ws: boolean
  wf: boolean
  oxc: boolean
  overwrite?: boolean
}
