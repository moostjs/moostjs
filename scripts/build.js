import minimist from 'minimist'
import fs from 'node:fs/promises'
import path from 'path'
import execa from 'execa'

import { packages, require, out } from './utils.js'

const allTargets = packages.filter(({ pkg }) => pkg && !pkg.private).map(({ shortName }) => shortName)
const args = minimist(process.argv.slice(2))
const targets = args._

run()

async function run() {
    await buildTargets(targets.length ? targets : allTargets)
}

async function buildTargets(targets) {
    await runParallel(require('os').cpus().length, targets, build)
}

async function runParallel(maxConcurrency, source, iteratorFn) {
    const ret = []
    const executing = []
    for (const item of source) {
        const p = Promise.resolve().then(() => iteratorFn(item, source))
        ret.push(p)

        if (maxConcurrency <= source.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1))
            executing.push(e)
            if (executing.length >= maxConcurrency) {
                await Promise.race(executing)
            }
        }
    }
    return Promise.all(ret)
}

async function build(target) {
    const pkgDir = path.resolve(`packages/${target}`)
    const pkg = require(`${pkgDir}/package.json`)

    if (pkg.private) return

    const env = 'production'

    out.log()
    out.step(`Rollup ${target}...`)

    await execa(
        'npx',
        [
            'rollup',
            '-c',
            'rollup.config.js',
            '--environment',
            [
                `NODE_ENV:${env}`,
                `TARGET:${target}`,
                `PROJECT:${pkg.name}`,
            ]
                .filter(Boolean)
                .join(',')
        ],
        { stdio: 'inherit' }
    )

    if (pkg.types) {
        out.step(`Rolling up type definitions for ${target}...`)

        // build types
        const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')

        try {
            const filePath = path.join(pkgDir, 'dist', 'packages', target, 'src', 'index.d.ts')
            const file = (await fs.readFile(filePath)).toString()
            await fs.writeFile(filePath, file.replace(/['"]@moostjs\/([^'"]+)/g, '\'../../$1/src'))
            const extractorConfigPath = path.resolve(pkgDir, `api-extractor.json`)
            const extractorConfig =
                ExtractorConfig.loadFileAndPrepare(extractorConfigPath)
            const extractorResult = Extractor.invoke(extractorConfig, {
                localBuild: true,
                showVerboseMessages: true,
                // showDiagnostics: true,
            })

            if (extractorResult.succeeded) {
                out.success(`✅ API Extractor completed successfully.`)
            } else {
                out.error(
                    `API Extractor completed with ${extractorResult.errorCount} errors` +
                    ` and ${extractorResult.warningCount} warnings`
                )
                process.exitCode = 1
            }
        } catch (e) {
            out.error(e.message)
        }

        await fs.rm(`${pkgDir}/dist/packages`, { recursive: true, force: true })
        await fs.rm(`${pkgDir}/dist/common`, { recursive: true, force: true })
    }
}
