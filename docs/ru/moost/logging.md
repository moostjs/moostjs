# Logs

Moost inherits a logging mechanism from Wooks based on the
[@prostojs/logger](https://github.com/prostojs/logger/) npm package, which
provides a convenient way to manage and track log messages.

## Logger Options

The following options can be configured for the logger:

- `topic` (optional): Specifies a topic or category for log messages to help
  organize and categorize the logs based on different topics.
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

# Logger and EventLogger
In Wooks, you have two options for configuring logging: `logger` and `eventLogger`.

-  `logger`: This option allows you to define a single logger for the entire Wooks instance.
It provides a unified logging experience across all events and commands.
-  `eventLogger`: With the eventLogger option, you can customize the logging behavior for each event in Wooks.
Each event will have its own logger instance, identified by an `eventId`.
This allows you to have granular control over event-specific logging and even persist log messages during the execution of an event using the `persistLevel` option.

## Usage

To create a Moost application with customized logging configuration, you can
provide the `eventOptions` object when initializing your Moost instance. This
can be achieved using the `createMoostApp` function.

Here's an example that demonstrates the creation of a Moost HTTP adapter with
logging configuration:

```ts
import { MoostHttp } from '@moostjs/event-http';

const httpAdapter = new MoostHttp({
  logger: {
    topic: "my-moost-app",
    level: 2, // Allow only fatal and error logs
    transports: [
      (log) =>
        console.log(
          `[${log.topic}][${log.type}] ${log.timestamp}`,
          ...log.messages,
        ),
    ],
  },
  eventOptions: {
    eventLogger: {
      level: 5, // Allow fatal, error, warn, log, info, and debug logs
      persistLevel: 3, // Persist only fatal, error, and warn logs
    },
  },
});
```

The example above demonstrates the configuration of a Moost HTTP adapter. The
`logger` option is used to define the logging behavior for the entire Moost
instance. It specifies the topic, log level, and transports for the logger. In
this case, log messages at the `fatal` and `error` levels are allowed, and the
log messages are sent to the console.

To use the event logger within a controller, you can inject it using the
`@InjectEventLogger` decorator. Here's an example:

```ts
import { Get } from '@moostjs/event-http';
import { EventLogger, Controller, InjectEventLogger } from 'moost';

@Controller()
class MyController {
  @Get("endpoint")
  handleRequest(@InjectEventLogger() logger: EventLogger) {
    // Controller logic for handling the request
    logger.log("...");
  }
}
```

In the example above, the `MyController` class
has an event handler method `handleRequest`, which receives the event logger
instance injected using the `@InjectEventLogger` decorator. The event logger can
be used to log messages within the event handler.

For more details on logging in Moost, please refer to the
[Logging in Wooks](https://wooksjs.org/wooks/advanced/logging.html) page as
Moost logging is based on the Wooks logging mechanism.
