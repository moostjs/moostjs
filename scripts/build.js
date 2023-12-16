import minimist from 'minimist'
import path from 'path'
import execa from 'execa'

import { packages, require, out } from './utils.js'

const allTargets = packages
    .filter(({ pkg }) => pkg && !pkg.private)
    .map(({ shortName }) => shortName)
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
            [`NODE_ENV:${env}`, `TARGET:${target}`, `PROJECT:${pkg.name}`]
                .filter(Boolean)
                .join(','),
        ],
        { stdio: 'inherit' }
    )
}
