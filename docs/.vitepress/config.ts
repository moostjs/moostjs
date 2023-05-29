import { defineConfig, DefaultTheme } from 'vitepress'

const ogDescription = 'Metadata Driven Event Processing Framework'
const ogImage = 'https://moost.dev/og-image.png'
const ogTitle = 'Moost'
const ogUrl = 'https://moost.dev'

// netlify envs
// const deployURL = process.env.DEPLOY_PRIME_URL || ''
// const commitRef = process.env.COMMIT_REF?.slice(0, 8) || 'dev'

export default defineConfig({
    lang: 'en-US',
    title: ' ',
    description: 'Metadata Driven Event Processing Framework',

    titleTemplate: ':title | Moost',

    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: ogTitle }],
        ['meta', { property: 'og:image', content: ogImage }],
        ['meta', { property: 'og:url', content: ogUrl }],
        ['meta', { property: 'og:description', content: ogDescription }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:site', content: '@moostjs' }],
        ['meta', { name: 'theme-color', content: '#3d61be' }],
    ],

    vue: {
        reactivityTransform: true,
    },

    themeConfig: {
        logo: '/moost-full-logo.png', //'/logo.svg',

        search: {
            provider: 'local'
        },

        editLink: {
            pattern: 'https://github.com/moostjs/moostjs/edit/main/docs/:path',
            text: 'Suggest changes to this page',
        },

        socialLinks: [
            // { icon: 'twitter', link: 'https://twitter.com/moostjs' },
            //   { icon: 'discord', link: 'https://chat.moostjs.dev' },
            { icon: 'github', link: 'https://github.com/moostjs/moostjs' },
        ],

        footer: {
            message: `Released under the MIT License.`,
            copyright: 'Copyright © 2023-present Artem Maltsev',
        },

        nav: [
            { text: 'Moost', link: '/moost/', activeMatch: '/moost/' },
            { text: 'Web App', link: '/webapp/', activeMatch: '/webapp/' },
            { text: 'CLI App', link: '/cliapp/', activeMatch: '/cliapp/' },
            // { text: 'Config', link: '/config/', activeMatch: '/config/' },
            // { text: 'Plugins', link: '/plugins/', activeMatch: '/plugins/' },
            {
                text: 'Resources',
                items: [
                    { text: 'Team', link: '/team' },
                    {
                        items: [
                            // {
                            //     text: 'Twitter',
                            //     link: 'https://twitter.com/moostjs',
                            // },
                            //   {
                            //     text: 'Discord Chat',
                            //     link: 'https://chat.moostjs.dev',
                            //   },
                            //   {
                            //     text: 'DEV Community',
                            //     link: 'https://dev.to/t/moostjs',
                            //   },
                            {
                                text: 'Changelog',
                                link: 'https://github.com/moostjs/moostjs/blob/main/CHANGELOG.md',
                            },
                        ],
                    },
                ],
            },
            //   {
            //     text: 'Version',
            //     items: versionLinks,
            //   },
        ],

        sidebar: {
            '/moost/': [
                {
                    text: 'Moost',
                    items: [
                        {
                            text: 'Why Moost',
                            link: '/moost/why',
                        },
                        {
                            text: 'Introduction',
                            link: '/moost/',
                        },
                    ],
                }, {
                    text: 'Foundation',
                    items: [
                        {
                            text: 'Dependency Injection',
                            link: '/moost/di/',
                            items: [{
                                    text: 'Circular Dependencies',
                                    link: '/moost/di/circular',
                                }, {
                                    text: 'Provide-Inject',
                                    link: '/moost/di/provide-inject',
                                }, {
                                    text: 'Functional Instantiation',
                                    link: '/moost/di/functional',
                                }],
                        },
                        {
                            text: 'Controllers',
                            link: '/moost/controllers',
                        },
                        {
                            text: 'Resolvers',
                            link: '/moost/resolvers',
                        },
                        {
                            text: 'Interceptors',
                            link: '/moost/interceptors',
                        },
                        {
                            text: 'Pipelines',
                            link: '/moost/pipelines',
                        },
                        {
                            text: 'Metadata',
                            items: [
                                {
                                    text: 'Overview',
                                    link: '/moost/meta/'
                                },
                                {
                                    text: 'Common Fields',
                                    link: '/moost/meta/common'
                                },
                                {
                                    text: 'Controller Metadata',
                                    link: '/moost/meta/controller'
                                },
                                {
                                    text: 'Enhancing Metadata',
                                    link: '/moost/meta/enhancing'
                                },
                            ]
                        },
                        {
                            text: 'Logs',
                            link: '/moost/logging',
                        },
                    ]
                }],
            '/webapp/': [{
                    text: 'Web Application',
                    items: [
                        {
                            text: 'Quick Start',
                            link: '/webapp/',
                        },
                        {
                            text: 'Controllers',
                            collapsed: true,
                            items: [
                                {
                                    text: 'Controllers Overview',
                                    link: '/webapp/controllers/',
                                }, {
                                    text: 'Using Controllers',
                                    link: '/webapp/controllers/usage',
                                }, {
                                    text: 'Reuse of Controllers',
                                    link: '/webapp/controllers/reuse',
                                }, {
                                    text: 'Scope of Controller',
                                    link: '/webapp/controllers/scope',
                                },
                            ],
                        },
                        {
                            text: 'Request',
                            link: '/webapp/request',
                        },
                        {
                            text: 'Response',
                            collapsed: true,
                            items: [
                                {
                                    text: 'General Response',
                                    link: '/webapp/response',
                                },
                                {
                                    text: 'Handling Errors',
                                    link: '/webapp/errors',
                                },
                                {
                                    text: 'Static Files',
                                    link: '/webapp/static',
                                },
                                {
                                    text: 'Proxy',
                                    link: '/webapp/proxy',
                                },
                            ]
                        },
                        {
                            text: 'Interceptors',
                            collapsed: true,
                            items: [
                                {
                                    text: 'Introduction to Interceptors',
                                    link: '/webapp/interceptors/',
                                },
                                {
                                    text: 'Guard Example',
                                    link: '/webapp/interceptors/guards',
                                },
                                {
                                    text: 'Logger Example',
                                    link: '/webapp/interceptors/logger',
                                },
                                {
                                    text: 'Error Handler',
                                    link: '/webapp/interceptors/errors',
                                },
                            ]
                        },
                        {
                            text: 'Adapters',
                            collapsed: true,
                            items: [
                                {
                                    text: 'Express',
                                    link: '/webapp/adapters/express',
                                },
                                {
                                    text: 'Fastify',
                                    link: '/webapp/adapters/fastify',
                                },
                            ]
                        },
                    ],
                }],
            '/cliapp/': [{
                    text: 'CLI Application',
                    items: [
                        {
                            text: 'Quick Start',
                            link: '/cliapp/',
                        },
                        {
                            text: 'Routing',
                            link: '/cliapp/routing',
                        },
                        {
                            text: 'Controllers',
                            link: '/cliapp/controllers',
                        },
                        {
                            text: 'Command Usage',
                            link: '/cliapp/help',
                        },
                    ],
                },
            ],
            // '/config/': [
            //     {
            //         text: 'Config',
            //         items: [
            //             {
            //                 text: 'Configuring Wooks',
            //                 link: '/config/',
            //             },
            //         ],
            //     },
            // ],
        },
    },
})
