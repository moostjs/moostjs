import { join } from "path";
import { PROJECT } from "./constants.js";
import { out, packages } from "./utils.js";
import { rimrafSync } from 'rimraf';
import { mkdirSync } from "fs";
import execa from 'execa'

for (const {
    name,
    shortName,
    pkgPath,
    pkgRoot,
    pkg,
} of packages) {

    const deps = Array.from(new Map([
     ...Object.entries(pkg.dependencies || {}),
     ...Object.entries(pkg.devDependencies || {}),
     ...Object.entries(pkg.peerDependencies || {}),
    ]).keys())

    const toLink = new Map()
    deps.forEach(d => {
        if (d === PROJECT) {
            toLink.set(d, { link: `../../${ d }` })
        } else {
            const parts = d.split('/')
            if (parts[0] === `@${PROJECT}js`) {
                toLink.set(parts[0], { dir: true })
                toLink.set(d, { link: `../../${parts[1]}` })
            }
        }
    })
    
    out.step('Linking ' + name)
    const nmPath = join(pkgRoot, 'node_modules')
    rimrafSync(nmPath)
    out.success('-   UNLINKED ' + nmPath)
    mkdirSync(nmPath)
    for (const [target, { dir, link }] of toLink.entries()) {
        const path = join(nmPath, target)
        if (dir) {
            mkdirSync(path)
            out.success('-   CREATED ' + target)
        } else if (link) {
            const from = join(nmPath, link)
            execa.sync('ln', ['-s', from, path])
            out.success('-   LINKED ' + target + ' -> ' + from)
        }
    }
}
