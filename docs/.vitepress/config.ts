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
            { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
            { text: 'HTTP', link: '/guide/http/', activeMatch: '/guide/http/' },
            { text: 'CLI', link: '/guide/cli/', activeMatch: '/guide/cli/' },
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
            '/guide/': [
                {
                    text: 'Guide',
                    items: [
                        {
                            text: 'Why Moost',
                            link: '/guide/why',
                        },
                        {
                            text: 'Getting Started',
                            link: '/guide/',
                        },
                        // {
                        //     text: 'Features',
                        //     link: '/guide/features',
                        // },
                        // {
                        //   text: 'CLI',
                        //   link: '/guide/cli',
                        // },
                    ],
                },
                {
                    text: 'Web Application',
                    collapsed: true,
                    items: [
                        {
                            text: 'Quick Start of Web App',
                            link: '/guide/http/',
                        },
                        {
                            text: 'Controllers',
                            link: '/guide/http/controllers',
                        },
                        {
                            text: 'Request Data',
                            link: '/guide/http/request',
                        },
                    ],
                },
                {
                    text: 'Moost CLI',
                    collapsed: true,
                    items: [
                        {
                            text: 'Quick Start CLI',
                            link: '/guide/cli/',
                        },
                    ],
                },
                {
                    text: 'Advanced',
                    collapsed: true,
                    items: [
                        // {
                        //     text: 'Event Context',
                        //     link: '/guide/advanced/context',
                        // },
                    ],
                },
                // {
                //     text: 'APIs',
                //     items: [
                //         {
                //             text: 'Plugin API',
                //             link: '/guide/api-plugin',
                //         },
                //     ],
                // },
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
