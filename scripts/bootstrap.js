import minimist from 'minimist'
const args = minimist(process.argv.slice(2))
import fs from 'fs'
import path from 'path'

import { packages, version, packagesDir, out } from './utils.js'
import { PROJECT } from './constants.js'

packages.forEach(({ shortName, name, pkg, pkgPath }) => {
    if (pkg?.private) return
    out.step('Package ' + name + ':')
    if (args.force || !pkg) {
        const json = {
            name,
            version,
            description: name,
            main: 'dist/index.cjs',
            module: 'dist/index.mjs',
            types: 'dist/index.d.ts',
            sideEffects: false,
            exports: {
                './package.json': './package.json',
                '.': {
                  import: './dist/index.mjs',
                  require: './dist/index.cjs',
                  types: './dist/index.d.ts'
                },
            },            
            files: ['dist'],
            repository: {
                type: 'git',
                url: `git+https://github.com/${ PROJECT }js/${ PROJECT }js.git`,
                directory: 'packages/' + shortName,
            },
            keywords: [
                PROJECT,
                PROJECT + 'js',
                'composables',
                'framework',
                'wooksjs',
                'prostojs',
            ],
            author: 'Artem Maltsev',
            license: 'MIT',
            bugs: {
                url: `https://github.com/${ PROJECT }js/${ PROJECT }js/issues`,
            },
            homepage: `https://github.com/${ PROJECT }js/${ PROJECT }js/tree/main/packages/${shortName}#readme`,
        }

        fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2))
        out.success(`✅ package.json created`)
    } else {
        if (pkg.name !== name || pkg.version !== version) {
            pkg.name = name
            pkg.version = version
            pkg.repository.directory = 'packages/' + shortName
            pkg.homepage = `https://github.com/${ PROJECT }js/${ PROJECT }js/tree/main/packages/${shortName}#readme`
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
            out.success(`⚠️ package.json fixed`)
        } else {
            out.log(`- package.json already exists`)
        }
    }

    const readmePath = path.join(packagesDir, shortName, `README.md`)
    if (args.force || !fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, `# ${name}`)
        out.success(`✅ README.md created`)
    } else {
        out.log(`- README.md already exists`)
    }

    const srcDir = path.join(packagesDir, shortName, `src`)
    const indexPath = path.join(packagesDir, shortName, `src/index.ts`)
    if (args.force || !fs.existsSync(indexPath)) {
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir)
        }
        fs.writeFileSync(indexPath, `console.log('hello world')\n`)
        out.success(`✅ src/index.ts created`)
    } else {
        out.log(`- src/index.ts already exists`)
    }
})
