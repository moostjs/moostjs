# Logger Example

In this example, we will create an interceptor that logs the processing time of each request,
along with the request ID, URL, and method.
We will use Wooks and the `@wooksjs/event-http` library for accessing request information.

## Functional Interceptor

First, let's create a functional interceptor that logs the request time:

```ts
// time-logger.interceptor.ts
import { defineInterceptorFn } from 'moost';
import { useRequest } from '@wooksjs/event-http';
import { useEventLogger } from '@wooksjs/event-core';

const timeLogger = defineInterceptorFn((onBefore, onAfter, onError) => {
    const { reqId, method, url } = useRequest();
    const logger = useEventLogger('time');
    const startTime = new Date();

    function logTime() {
        const processingTime = new Date().getTime() - startTime.getTime();
        logger.log(`Request ID: ${reqId()} | URL: ${url} | Method: ${method} | Processing Time: ${processingTime}ms`);
    }

    onAfter(logTime);
    onError(logTime);
});

export default timeLogger;
```

In this functional interceptor, we use the `useRequest` composable from `@wooksjs/event-http` to access the request
information such as the request ID, method, and URL.
We also use the `useEventLogger` composable from `@wooksjs/event-core` to obtain a logger instance for logging purposes.

By utilizing the `onAfter` and `onError` hooks, we call the `logTime` function to calculate the processing time and log the request details along with the processing time.

To apply this interceptor to a controller, we use the `@Intercept` decorator:

```ts
import { Get } from '@wooksjs/event-http';
import { Intercept, Controller } from 'moost';
import timeLogger from './time-logger.interceptor.ts';

@Controller()
@Intercept(timeLogger)  // [!code hl]
class MyController {
    @Get('endpoint')
    handleRequest() {
        // Controller logic for handling the request
    }
}
```

## Class-Based Interceptor
Now, let's transform our functional interceptor into a class-based interceptor that makes use of Moost resolvers:

```ts
// time-logger.interceptor.ts
import { Method, ReqId, Url } from '@moostjs/event-http';
import { EventLogger, InjectEventLogger, Injectable, TClassFunction, TInterceptorFn } from 'moost';

@Injectable('FOR_EVENT')    
export class TimeLogger implements TClassFunction<TInterceptorFn> {  
    constructor(@InjectEventLogger() private logger: EventLogger) {}

    private startTime = new Date();

    @ReqId()        
    private reqId = '';

    @Url()         
    private url = '';

    @Method()    
    private method = '';

    handler: TInterceptorFn = (onBefore, onAfter, onError) => {
        onAfter(this.logTime.bind(this));
        onError(this.logTime.bind(this));
    };

    private logTime() {
        const processingTime = new Date().getTime() - this.startTime.getTime();
        this.logger.log(`Request ID: ${this.reqId} | URL: ${this.url} | Method: ${this.method} | Processing Time: ${processingTime}ms`);
    }
}

export default TimeLogger;
```

To define the `TimeLogger` class-based interceptor we defined a class that implements `TClassFunction<TInterceptorFn>`.
We use Moost's decorators such as `@ReqId`, `@Url`, and `@Method` to automatically resolve the corresponding request information.

By injecting the `EventLogger` using `@InjectEventLogger`, we can access the logger instance for logging purposes.

The handler method serves as the interceptor function, and we utilize the `onAfter` and `onError` hooks to call the logTime method, which calculates the processing time and logs the request details.

We can easily apply the class-based interceptor to a controller, we again use the `@Intercept` decorator:

```ts
import { Get } from '@wooksjs/event-http';
import { Intercept, Controller } from 'moost';
import TimeLogger from './time-logger.interceptor.ts';

@Controller()
@Intercept(TimeLogger)  // [!code hl]
class MyController {
    @Get('endpoint')
    handleRequest() {
        // Controller logic for handling the request
    }
}
```

By applying the `TimeLogger` class as the interceptor using the `@Intercept` decorator,
we achieve the same functionality as the functional interceptor but with the added benefits of Moost's
resolvers and easier unit testing capabilities.
