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
                            link: '/moost/di',
                            items: [{
                                text: 'Circular Dependencies',
                                link: '/moost/circular',
                            },{
                                text: 'Provide-Inject',
                                link: '/moost/provide-inject',
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
                            text: 'Logging',
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
                            link: '/webapp/controllers',
                        },
                        {
                            text: 'Request',
                            link: '/webapp/request',
                        },
                        {
                            text: 'Response',
                            link: '/webapp/response',
                        },
                        {
                            text: 'Interceptors',
                            link: '/webapp/interceptors/',
                            items: [
                                {
                                    text: 'Guard Example',
                                    link: '/webapp/interceptors/guards',
                                },
                                {
                                    text: 'Logger Example',
                                    link: '/webapp/interceptors/logger',
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
