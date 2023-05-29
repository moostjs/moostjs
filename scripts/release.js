import minimist from 'minimist'
import fs from 'node:fs'
import path from 'path'
import execa from 'execa'
import semver from 'semver'
const { prompt } = require('enquirer')

import {
    packages,
    require,
    out,
    version as currentVersion,
    __dirname,
    mainPkg,
} from './utils.js'
import { PROJECT } from './constants.js'

const args = minimist(process.argv.slice(2))

const preId =
    args.preid ||
    (semver.prerelease(currentVersion) && semver.prerelease(currentVersion)[0])
const isDryRun = args.dry
const skipTests = args.skipTests
const skipBuild = args.skipBuild

if (isDryRun) {
    out.warn('Dry Run!')
}
if (skipBuild) {
    out.warn('Skip Build!')
}

const skippedPackages = []

const versionIncrements = [
    'patch',
    'minor',
    'major',
    ...(preId ? ['prepatch', 'preminor', 'premajor', 'prerelease'] : []),
]

const inc = (i) => semver.inc(currentVersion, i, preId)
const bin = (name) => path.resolve(__dirname, '../node_modules/.bin/' + name)
const run = (bin, args, opts = {}) =>
    execa(bin, args, { stdio: 'inherit', ...opts })
const dryRun = (bin, args, opts = {}) =>
    out.info(`[dryrun] ${bin} ${args.join(' ')}`, opts)
const runIfNotDry = isDryRun ? dryRun : run

async function main() {
    let targetVersion = args._[0]

    if (!targetVersion) {
        // no explicit version, offer suggestions
        const { release } = await prompt({
            type: 'select',
            name: 'release',
            message: 'Select release type',
            choices: versionIncrements
                .map((i) => `${i} (${inc(i)})`)
                .concat(['custom']),
        })

        if (release === 'custom') {
            targetVersion = (
                await prompt({
                    type: 'input',
                    name: 'version',
                    message: 'Input custom version',
                    initial: currentVersion,
                })
            ).version
        } else {
            targetVersion = release.match(/\((.*)\)/)[1]
        }
    }

    if (!semver.valid(targetVersion)) {
        throw new Error(`invalid target version: ${targetVersion}`)
    }

    const { yes } = await prompt({
        type: 'confirm',
        name: 'yes',
        message: `Releasing v${targetVersion}. Confirm?`,
    })

    if (!yes) {
        return
    }

    // run tests before release
    out.step('Running tests...')
    if (!skipTests && !isDryRun) {
        await run(bin('jest'), ['--clearCache'])
    } else {
        out.warn(`(skipped)`)
    }

    // update all package versions and inter-dependencies
    out.step('Updating cross dependencies...')
    updateVersions(targetVersion)

    // build all packages with types
    out.step('Building all packages...')
    if (!skipBuild && !isDryRun) {
        await run('npm', ['run', 'build', '--release'])
        // test generated dts files
        // out.step('Verifying type declarations...')
        // await run('npm', ['run', 'test-dts-only'])
    } else {
        out.warn(`(skipped)`)
    }

    // generate changelog
    out.step('Generating changelog...')
    await run(`npm`, ['run', 'changelog'])

    // update package-lock.json
    out.step('Updating lockfile...')
    await run(`npm`, ['install', '--prefer-offline'])

    const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
    if (stdout) {
        out.step('Committing changes...')
        await runIfNotDry('git', ['add', '-A'])
        await runIfNotDry('git', ['commit', '-m', `release: v${targetVersion}`])
    } else {
        console.log('No changes to commit.')
    }

    // publish packages
    out.step('Publishing packages...')
    for (const pkg of packages) {
        await publishPackage(pkg, targetVersion, runIfNotDry)
    }

    // push to GitHub
    out.step('Pushing to GitHub...')
    await runIfNotDry('git', ['tag', `v${targetVersion}`])
    await runIfNotDry('git', ['push', 'origin', `refs/tags/v${targetVersion}`])
    await runIfNotDry('git', ['push'])

    if (isDryRun) {
        console.log(`\nDry run finished - run git diff to see package changes.`)
    }

    if (skippedPackages.length) {
        out.warn(
            `The following packages are skipped and NOT published:\n- ${skippedPackages.join(
                '\n- '
            )}`
        )
    }
    console.log()
}

function updateVersions(version) {
    // 1. update root package.json
    updatePackage(path.resolve(__dirname, '..', 'package.json'), version)
    // 2. update all packages
    packages.forEach((p) => updatePackage(p.pkgPath, version))
}

function updatePackage(pkgPath, version) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    pkg.version = version
    updateDeps(pkg, 'dependencies', version)
    updateDeps(pkg, 'peerDependencies', version)
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function updateDeps(pkg, depType, version) {
    const deps = pkg[depType]
    if (!deps) return
    updateDepsFrom(pkg, mainPkg, depType)
    Object.keys(deps).forEach((dep) => {
        if (dep === PROJECT || dep.startsWith(`@${ PROJECT }js`)) {
            out.warn(`${pkg.name} -> ${depType} -> ${dep}@${version}`)
            deps[dep] = version
        }
    })
}

function updateDepsFrom(targetPkg, sourcePkg, depType) {
    const deps = targetPkg[depType]
    if (!deps) return
    Object.keys(deps).forEach((dep) => {
        if (sourcePkg.dependencies && sourcePkg.dependencies[dep]) {
            deps[dep] = sourcePkg.dependencies[dep]
        }
        if (sourcePkg.devDependencies && sourcePkg.devDependencies[dep]) {
            deps[dep] = sourcePkg.devDependencies[dep]
        }
        if (sourcePkg.peerDependencies && sourcePkg.peerDependencies[dep]) {
            deps[dep] = sourcePkg.peerDependencies[dep]
        }
    })
}

async function publishPackage(pkg, version, runIfNotDry) {
    if (skippedPackages.includes(pkg.name)) {
        return
    }
    if (pkg.pkg.private) {
        return
    }

    let releaseTag = null
    if (args.tag) {
        releaseTag = args.tag
    } else if (version.includes('alpha')) {
        releaseTag = 'alpha'
    } else if (version.includes('beta')) {
        releaseTag = 'beta'
    } else if (version.includes('rc')) {
        releaseTag = 'rc'
    }

    out.step(`Publishing ${pkg.name}...`)
    try {
        await runIfNotDry(
            'npm',
            [
                'publish',
                '--access',
                'public',
                '--registry=https://registry.npmjs.org/',
            ],
            {
                cwd: pkg.pkgRoot,
                stdio: 'pipe',
            }
        )
        out.success(`Successfully published ${pkg.name}@${version}`)
    } catch (e) {
        if (e.stderr.match(/previously published/)) {
            out.error(`Skipping already published: ${pkg.name}`)
        } else {
            throw e
        }
    }
}

main().catch((err) => {
    updateVersions(currentVersion)
    out.error(err)
})
