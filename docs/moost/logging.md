# Logging in Moost

Moost inherits a logging mechanism from Wooks based on the
[@prostojs/logger](https://github.com/prostojs/logger/) npm package, which
provides a convenient way to manage and track log messages.

## Logger Options

The following options can be configured for the logger:

- `persistLevel` (optional): Defines the maximum log level that will be
  persisted in the logger instance. Messages above this level will not be
  persisted.
- `level` (optional): Filters log messages based on the specified log level.
  Only log messages at or below this level will be processed and sent to
  transports.
- `transports` (optional): An array of functions that handle log messages.
  Transports can be used to send log messages to various destinations, such as
  the console, files, or external APIs.
- `mapper` (optional): A function that maps log messages to a desired format,
  allowing customization of the structure or content of the log messages.
- `levels` (optional): A list of log level names. By default, the levels include
  `fatal`, `error`, `warn`, `log`, `info`, `debug`, and `trace`. This list can
  be customized to meet specific logging requirements.

::: tip Topics
`topic` is not a logger option. To scope log messages by topic, derive a topic
logger from an existing one: `app.getLogger('my-topic')` on the Moost instance,
or `logger.createTopic('my-topic')` on a `ProstoLogger`.
:::

## App Logger and Event Logger

There is one **app-level logger** — pass it as a logger *instance* via Moost or
adapter options (`new Moost({ logger })`, `new MoostHttp({ logger })`; see the
`TMoostOptions` interface for the Moost constructor options: `logger`,
`globalPrefix`). Inside event handlers and interceptors, the **event-scoped
logger** is obtained with the `useLogger()` composable (re-exported from
`moost`) or injected with `@InjectEventLogger()`.

::: tip DI logging
Moost also logs dependency-injection events (instance creation, warnings,
errors) through this logger. Tune the verbosity with
`setInfactLoggingOptions({ newInstance: 'FOR_EVENT', warn: true, error: true })`
from `moost`.
:::

## Usage

To customize logging, create a logger instance and pass it to the HTTP adapter.
The `MoostHttp` constructor signature is
`new MoostHttp(httpApp?: WooksHttp | TWooksHttpOptions)`, where
`TWooksHttpOptions.logger` is a logger *instance* (type `TConsoleBase`). Use the
`createLogger` helper exported from `moost` to build one.

Here's an example that demonstrates the creation of a Moost HTTP adapter with
logging configuration:

```ts
import { Moost, createLogger, loggerConsoleTransport } from 'moost';
import { MoostHttp } from '@moostjs/event-http';

const logger = createLogger({
  level: 1, // Allow only fatal and error logs
  transports: [loggerConsoleTransport],
});

const app = new Moost();
const httpAdapter = new MoostHttp({ logger });

app.adapter(httpAdapter);
app.registerControllers(/* ...controllers */);
await app.init();
```

The example above demonstrates the configuration of a Moost HTTP adapter. The
`logger` option is a logger instance that defines the logging behavior for the
adapter. In this case, log messages at the `fatal` and `error` levels are
allowed (`level` is the index of the last allowed level in the `levels` list:
`fatal` = 0, `error` = 1, `warn` = 2, ...), and the log messages are sent to
the console.

To use the event logger within a controller, you can inject it using the
`@InjectEventLogger` decorator. Here's an example:

```ts
import { Get } from '@moostjs/event-http';
import type { Logger } from 'moost'
import { Controller, InjectEventLogger } from 'moost'

@Controller()
class MyController {
  @Get('endpoint')
  handleRequest(@InjectEventLogger() logger: Logger) {
    // Controller logic for handling the request
    logger.info('...')
  }
}
```

In the example above, the `MyController` class
has an event handler method `handleRequest`, which receives the event logger
instance injected using the `@InjectEventLogger` decorator. The event logger can
be used to log messages within the event handler.

## @InjectMoostLogger

While `@InjectEventLogger` provides event-scoped loggers from the Wooks context, `@InjectMoostLogger` resolves the **app-level** logger from the Moost instance. This is useful when you need a logger that lives outside the event lifecycle — for example, in singleton services that log during initialization or background work.

```ts
import { Controller, InjectMoostLogger } from 'moost'
import type { ProstoLogger } from 'moost'

@Controller()
class NotificationService {
  constructor(@InjectMoostLogger('notifications') private logger: ProstoLogger) {
    this.logger.log('NotificationService initialized')
  }
}
```

The optional `topic` argument sets the logger's topic (banner). Resolution order: the explicit argument wins; if no argument is passed, the class-level `@LoggerTopic` value is used; if neither is set, the class `@Id` metadata is used.

### @LoggerTopic

`@LoggerTopic` sets a default logger topic at the class level, used by `@InjectMoostLogger` when no explicit topic is passed:

```ts
import { Controller, InjectMoostLogger, LoggerTopic } from 'moost'
import type { ProstoLogger } from 'moost'

@LoggerTopic('mailer')
@Controller()
class MailerController {
  constructor(@InjectMoostLogger() private logger: ProstoLogger) {
    // logger topic is 'mailer'
  }
}
```

::: tip
An explicit topic passed to `@InjectMoostLogger('...')` takes precedence over the class-level `@LoggerTopic` — the class-level value is the fallback when no argument is passed.
:::

For more details on logging in Moost, please refer to the
[Logging in Wooks](https://wooks.moost.org/wooks/advanced/logging.html) page as
Moost logging is based on the Wooks logging mechanism.
