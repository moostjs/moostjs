export interface TInputs {
  name: string
  http: boolean
  cli: boolean
  wf: boolean
  domelint: boolean
  force: boolean
}

export interface TPrompts {
  targetDir: string
  projectName: string
  packageName: string
  type: 'cli' | 'http'
  wf: boolean
  domelint: boolean
  overwrite?: boolean
}
