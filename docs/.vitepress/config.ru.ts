import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const configRu: LocaleSpecificConfig = {
    lang: 'ru-RU',
    title: ' ',
    description: 'Обработка событий на основе метаданных',

    titleTemplate: ':title | Moost',

    themeConfig: {
        logo: '/moost-full-logo.png', //'/logo.svg',

        search: {
            provider: 'local'
        },

        editLink: {
            pattern: 'https://github.com/moostjs/moostjs/edit/main/docs/:path',
            text: 'Предложить изменения этой страницы',
        },

        socialLinks: [
            // { icon: 'twitter', link: 'https://twitter.com/moostjs' },
            //   { icon: 'discord', link: 'https://chat.moostjs.dev' },
            { icon: 'github', link: 'https://github.com/moostjs/moostjs' },
        ],

        footer: {
            message: `Выпущено под MIT лицензией.`,
            copyright: 'Copyright © 2023-present Артем Мальцев',
        },

        nav: [
            { text: 'Moost', link: '/ru/moost/', activeMatch: '/moost/' },
            { text: 'Web App', link: '/ru/webapp/', activeMatch: '/webapp/' },
            { text: 'CLI App', link: '/ru/cliapp/', activeMatch: '/cliapp/' },
            // { text: 'Config', link: '/ru/config/', activeMatch: '/config/' },
            // { text: 'Plugins', link: '/ru/plugins/', activeMatch: '/plugins/' },
            {
                text: 'Ресурсы',
                items: [
                    { text: 'Команда', link: '/ru/team' },
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
                                text: 'Журнал изменений',
                                link: 'https://github.com/moostjs/moostjs/blob/main/CHANGELOG.md',
                            },
                        ],
                    },
                ],
            },
        ],

        sidebar: {
            '/ru/moost/': [
                {
                    text: 'Moost',
                    items: [
                        {
                            text: 'Почему Moost',
                            link: '/ru/moost/why',
                        },
                        {
                            text: 'Вступление',
                            link: '/ru/moost/',
                        },
                    ],
                }, {
                    text: 'Основы',
                    items: [
                        {
                            text: 'Внедрение зависимостей',
                            link: '/ru/moost/di/',
                            items: [{
                                text: 'Циклические зависимости',
                                link: '/ru/moost/di/circular',
                            }, {
                                text: 'Provide-Inject',
                                link: '/ru/moost/di/provide-inject',
                            }, {
                                text: 'Функциональное инстанциирование',
                                link: '/ru/moost/di/functional',
                            }],
                        },
                        {
                            text: 'Контроллеры',
                            link: '/ru/moost/controllers',
                        },
                        {
                            text: 'Резолверы',
                            link: '/ru/moost/resolvers',
                        },
                        {
                            text: 'Интерсептеры',
                            link: '/ru/moost/interceptors',
                        },
                        {
                            text: 'Пайплайны',
                            link: '/ru/moost/pipelines',
                        },
                        {
                            text: 'Метаданные',
                            items: [
                                {
                                    text: 'Обзор метаданных',
                                    link: '/ru/moost/meta/'
                                },
                                {
                                    text: 'Общие поля',
                                    link: '/ru/moost/meta/common'
                                },
                                {
                                    text: 'Метаданные контроллера',
                                    link: '/ru/moost/meta/controller'
                                },
                                {
                                    text: 'Расширение метаданных',
                                    link: '/ru/moost/meta/enhancing'
                                },
                            ]
                        },
                        {
                            text: 'Logs',
                            link: '/ru/moost/logging',
                        },
                    ]
                }],
            '/ru/webapp/': [{
                text: 'Web Приложение',
                items: [
                    {
                        text: 'Быстрый старт',
                        link: '/ru/webapp/',
                    },
                    {
                        text: 'Контроллеры',
                        collapsed: true,
                        items: [
                            {
                                text: 'Обзор контроллеров',
                                link: '/ru/webapp/controllers/',
                            }, {
                                text: 'Использование контроллеров',
                                link: '/ru/webapp/controllers/usage',
                            }, {
                                text: 'Переиспользование контроллеров',
                                link: '/ru/webapp/controllers/reuse',
                            }, {
                                text: 'Скоп контроллера',
                                link: '/ru/webapp/controllers/scope',
                            },
                        ],
                    },
                    {
                        text: 'Обработчики запросов',
                        link: '/ru/webapp/handlers',
                    },
                    {
                        text: 'Запрос',
                        link: '/ru/webapp/request',
                    },
                    {
                        text: 'Ответ',
                        collapsed: true,
                        items: [
                            {
                                text: 'Простой ответ',
                                link: '/ru/webapp/response',
                            },
                            {
                                text: 'Обработка ошибок',
                                link: '/ru/webapp/errors',
                            },
                            {
                                text: 'Статические файлы',
                                link: '/ru/webapp/static',
                            },
                            {
                                text: 'Прокси',
                                link: '/ru/webapp/proxy',
                            },
                        ]
                    },
                    {
                        text: 'Интерсептеры',
                        collapsed: true,
                        items: [
                            {
                                text: 'Введение в интерсептеры',
                                link: '/ru/webapp/interceptors/',
                            },
                            {
                                text: 'Пример стража',
                                link: '/ru/webapp/interceptors/guards',
                            },
                            {
                                text: 'Пример логгера',
                                link: '/ru/webapp/interceptors/logger',
                            },
                            {
                                text: 'Обработчик ошибок',
                                link: '/ru/webapp/interceptors/errors',
                            },
                        ]
                    },
                    {
                        text: 'Адаптеры',
                        collapsed: true,
                        items: [
                            {
                                text: 'Express',
                                link: '/ru/webapp/adapters/express',
                            },
                            {
                                text: 'Fastify',
                                link: '/ru/webapp/adapters/fastify',
                            },
                        ]
                    },
                ],
            }],
            '/ru/cliapp/': [{
                text: 'CLI Приложение',
                items: [
                    {
                        text: 'Быстрый старт',
                        link: '/ru/cliapp/',
                    },
                    {
                        text: 'Навигация',
                        link: '/ru/cliapp/routing',
                    },
                    {
                        text: 'Контроллеры',
                        link: '/ru/cliapp/controllers',
                    },
                    {
                        text: 'Помощь по командам',
                        link: '/ru/cliapp/help',
                    },
                ],
            },
            ],
        },
    },
}