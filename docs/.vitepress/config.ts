import { defineConfig, DefaultTheme } from 'vitepress'
// import { configRu } from './config.ru'

const ogDescription = 'Moost is a Metadata Driven Event Processing Framework. Official Documentation Website.'
const ogImage = 'https://moost.org/og-moost.png'
const twitterImage = 'https://moost.org/moostjs-small.png'
const ogTitle = 'Moost'
const ogUrl = 'https://moost.org'

// netlify envs
// const deployURL = process.env.DEPLOY_PRIME_URL || ''
// const commitRef = process.env.COMMIT_REF?.slice(0, 8) || 'dev'

export default defineConfig({
    lang: 'en-US',
    title: ' ',
    description: 'Metadata Driven Event Processing Framework',

    ignoreDeadLinks: 'localhostLinks',

    titleTemplate: ':title | Moost',

    // locales: {
    //     root: {
    //         label: 'English',
    //         lang: 'en',
    //         link: '/',
    //     },
    //     ru: {
    //         label: 'Russian',
    //         lang: 'ru', // optional, will be added  as `lang` attribute on `html` tag
    //         link: '/ru/', // default /ru/ -- shows on navbar translations menu, can be external
    //         ...configRu,
    //     }
    // },

    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: ogTitle }],
        ['meta', { property: 'og:image', content: ogImage }],
        ['meta', { property: 'og:url', content: ogUrl }],
        ['meta', { property: 'og:description', content: ogDescription }],
        ['meta', { name: 'twitter:card', content: 'summary' }],
        ['meta', { name: 'twitter:site', content: '@MAVrik7' }],
        ['meta', { name: 'twitter:image', content: twitterImage }],
        ['meta', { name: 'theme-color', content: '#3d61be' }],
    ],

    vue: {
        // reactivityTransform: true,
    },

    themeConfig: {
        logo: '/moost-logo-3d.webp', //'/logo.svg',

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
            { text: 'Modules', items: [
                {
                    text: '@moostjs/event-http',
                    link: '/webapp/',
                },
                {
                    text: '@moostjs/event-cli',
                    link: '/cliapp/',
                },
                {
                    text: '@moostjs/event-wf',
                    link: '/wf/',
                },
                {
                    text: '@moostjs/swagger',
                    link: '/swagger/',
                },
                {
                    text: '@atscript/moost-validator',
                    link: '/validation/',
                },
            ] },
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
            '/wf/': [
                {
                    text: 'Overview',
                    link: '/wf/overview'
                },
                {
                    text: 'Quick Start',
                    link: '/wf/'
                },
                {
                    text: 'Workflow Entry Point',
                    link: '/wf/entry',
                },
                {
                    text: 'Workflow Steps',
                    link: '/wf/steps',
                },
                {
                    text: 'Workflow Schema',
                    link: '/wf/schema',
                },
                {
                    text: 'Workflow Context',
                    link: '/wf/context',
                },
                {
                    text: 'Retriable Error',
                    link: '/wf/retriable-error',
                },
                {
                    text: 'Interceptors and Pipes',
                    link: '/wf/interceptors-pipes',
                },
                {
                    text: 'API Reference',
                    link: '/wf/api'
                },
            ],
            '/validation/': [
                {
                    text: 'Validation in Moost',
                    link: '/validation/'
                },
                {
                    text: 'Validation API Ref',
                    link: '/validation/api'
                },
            ],
            '/swagger/': [
                {
                    text: '@moostjs/swagger',
                    items: [
                        { text: 'Overview', link: '/swagger/' },
                        { text: 'Decorators', link: '/swagger/decorators' },
                        { text: 'Serving Swagger UI', link: '/swagger/serving-ui' },
                    ],
                },
            ],
            '/moost/': [
                {
                    text: 'Overview',
                    collapsed: false,
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
                }, 
                {
                    text: 'Moost Adapters',
                    link: '/moost/adapters/',
                },
                {
                    text: 'Dependency Injection',
                    collapsed: false,
                    items: [{
                        text: 'Introduction to DI',
                        link: '/moost/di/',
                    }, {
                            text: 'Dependencies Substitution',
                            link: '/moost/di/provide-inject',
                        }, {
                            text: 'Circular Dependencies',
                            link: '/moost/di/circular',
                        }, {
                            text: 'Functional Instantiation',
                            link: '/moost/di/functional',
                        }],
                },
                {
                    text: 'Handling Events',
                    collapsed: false,
                    items: [
                        {
                            text: 'Event Lifecycle',
                            link: '/moost/event-lifecycle',
                        },
                        {
                            text: 'Controllers',
                            link: '/moost/controllers',
                        },
                        {
                            text: 'Interceptors',
                            link: '/moost/interceptors',
                        },
                        {
                            text: 'Pipelines',
                            collapsed: false,
                            items: [{
                                text: 'Introduction to Pipelines',
                                link: '/moost/pipes/',
                            },{
                                text: 'Resolve Pipe',
                                link: '/moost/pipes/resolve',
                            },{
                                text: 'Validation Pipe',
                                link: '/moost/pipes/validate',
                            },{
                                text: 'Custom Pipes',
                                link: '/moost/pipes/custom',
                            }]
                        },
                        {
                            text: 'Logging',
                            link: '/moost/logging',
                        },
                        {
                            text: 'Opentelemetry in Moost',
                            link: '/moost/otel',
                        },
                    ],
                    
                },
                        {
                            text: 'Metadata (Mate)',
                            collapsed: false,
                            items: [
                                {
                                    text: 'Introduction to Metadata',
                                    link: '/moost/meta/'
                                },
                                {
                                    text: 'General-Purpose Metadata',
                                    link: '/moost/meta/common'
                                },
                                {
                                    text: 'Customizing Metadata',
                                    link: '/moost/meta/custom'
                                },
                                {
                                    text: 'Controller Metadata',
                                    link: '/moost/meta/controller'
                                },
                                
                                {
                                    text: 'Metadata Inheritance',
                                    link: '/moost/meta/inherit'
                                },
                                
                            ]
                        },],
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
                                    text: 'Controller Reusability',
                                    link: '/webapp/controllers/reuse',
                                }, {
                                    text: 'Scope of Controller',
                                    link: '/webapp/controllers/scope',
                                },
                            ],
                        },
                        {
                            text: 'Routing',
                            link: '/webapp/routing',
                        },
                        {
                            text: 'Request Handlers',
                            link: '/webapp/handlers',
                        },
                        {
                            text: 'Request',
                            link: '/webapp/request',
                        },
                        {
                            text: 'Swagger Integration',
                            link: '/webapp/swagger',
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
