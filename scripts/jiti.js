import { __dirname, packages, require } from './utils.js'
import execa from 'execa'
import path from 'path'
import minimist from 'minimist'
const args = minimist(process.argv.slice(2))

const target =
    typeof args.dev === 'string' ? args.dev : (args._ && args._[0]) || 'moost'

const alias = {
    common: path.join(__dirname, '..', 'common'),
}

const origArgs = process.argv.slice(2)
const passIndex = origArgs.findIndex((a) => a == '--') + 1
let toPass = []
if (passIndex) {
    toPass = origArgs.slice(passIndex)
}

packages.forEach(({ name, shortName }) => {
    if (args.dev) {
        alias[name] = path.join(
            __dirname,
            '..',
            'packages',
            shortName,
            'src',
            'index.ts'
        )
    } else {
        alias[name] = path.join(
            __dirname,
            '..',
            'packages',
            shortName,
            'dist',
            'index.mjs'
        )
    }
})

// const pwd = process.cwd()
// const jiti = require('jiti')(pwd)

async function run() {
    // const file = path.resolve(`./explorations/${target}/`)
    // console.log({ file, alias })
    // process.env.JITI_ALIAS = JSON.stringify(alias)
    // jiti(jiti.resolve(file), {
    //     alias,
    //     transform: (opts) => {
    //         const _opts = {
    //           babelrc: false,
    //           configFile: false,
    //           compact: false,
    //           retainLines: typeof opts.retainLines === 'boolean' ? opts.retainLines : true,
    //           filename: '',
    //           cwd: '/',
    //           ...opts.babel,
    //           plugins: [
    //             [require('@babel/plugin-transform-modules-commonjs'), { allowTopLevelThis: true }],
    //             [require('babel-plugin-dynamic-import-node'), { noInterop: true }],
    //             [TransformImportMetaPlugin, { filename: opts.filename }],
    //             [require('@babel/plugin-syntax-class-properties')],
    //             [require('@babel/plugin-proposal-export-namespace-from')]
    //           ]
    //         }

    //         if (opts.ts) {
    //           _opts.plugins.push([require('@babel/plugin-transform-typescript'), { allowDeclareFields: true }])
    //           // `unshift` because this plugin must come before `@babel/plugin-syntax-class-properties`
    //           _opts.plugins.unshift([require('@babel/plugin-proposal-decorators'), { legacy: true }])
    //           _opts.plugins.push([require('@babel/plugin-proposal-class-properties'), { loose: true }])
    //           _opts.plugins.push(require('babel-plugin-parameter-decorator'))
    //         }

    //         if (opts.legacy) {
    //           _opts.plugins.push(require('@babel/plugin-proposal-nullish-coalescing-operator'))
    //           _opts.plugins.push(require('@babel/plugin-proposal-optional-chaining'))
    //         }

    //         if (opts.babel && Array.isArray(opts.babel.plugins)) {
    //           _opts.plugins?.push(...opts.babel.plugins)
    //         }

    //         try {
    //           return {
    //             code: transformSync(opts.source, _opts)?.code || ''
    //           }
    //         } catch (err) {
    //           return {
    //             error: err,
    //             code: 'exports.__JITI_ERROR__ = ' + JSON.stringify({
    //               filename: opts.filename,
    //               line: err.loc?.line || 0,
    //               column: err.loc?.column || 0,
    //               code: err.code?.replace('BABEL_', '').replace('PARSE_ERROR', 'ParseError'),
    //               message: err.message?.replace('/: ', '').replace(/\(.+\)\s*$/, '')
    //             })
    //           }
    //         }
    //       }
    // })
    await execa('npx', ['jiti', `./explorations/${target}/`, ...toPass], {
        stdio: 'inherit',
        env: {
            // JITI_DEBUG: 'true',
            JITI_ALIAS: JSON.stringify(alias),
        },
    })
}

run()
