import {
    ProstoLogger,
    coloredConsole,
    createConsoleTransort,
} from '@prostojs/logger'

export function getDefaultLogger(topic: string) {
    return new ProstoLogger(
        {
            level: 4,
            transports: [
                createConsoleTransort({
                    format: coloredConsole,
                }),
            ],
        },
        topic
    )
}
