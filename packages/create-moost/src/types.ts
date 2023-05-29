export interface TInputs {
    name: string
    http: boolean
    cli: boolean
    eslint: boolean
    prettier: boolean
    force: boolean
    esbuild: boolean
    rollup: boolean
}

export interface TPrompts {
    targetDir: string
    projectName: string
    packageName: string
    type: 'cli' | 'http'
    bundler: 'esbuild' | 'rollup'
    overwrite?: boolean
    eslint?: boolean
    prettier?: boolean
}
