import { packages, require } from './utils.js'
import { dye } from '@prostojs/dye'

const print = {
    header: dye('bold', 'bg-cyan').prefix(' '.repeat(5)).suffix(' '.repeat(5)).attachConsole(),
    subHeader: dye('cyan').prefix('  ').attachConsole(),
    item: dye('green', 'dim').prefix('    ').attachConsole(),
    item2: dye('green-bright').prefix('    ').attachConsole(),
    gray: dye('gray05'),
}

run()

function run() {
    for (const { pkg, name } of packages) {
        console.log()
        print.header(name)
        if (pkg.dependencies) {
            print.subHeader('dependencies')
            Object.entries(pkg.dependencies).map(e => [e[0], print.gray(e[1])].join('\t')).forEach(i => i.startsWith('@moostjs') ? print.item2(i) : print.item(i))
        }
        if (pkg.devDependencies) {
            print.subHeader('devDependencies')
            Object.entries(pkg.devDependencies).map(e => [e[0], print.gray(e[1])].join('\t')).forEach(i => i.startsWith('@moostjs') ? print.item2(i) : print.item(i))
        }
        if (pkg.peerDependencies) {
            print.subHeader('peerDependencies')
            Object.entries(pkg.peerDependencies).map(e => [e[0], print.gray(e[1])].join('\t')).forEach(i => i.startsWith('@moostjs') ? print.item2(i) : print.item(i))
        }
        console.log()
    }
}