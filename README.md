# moostjs

**!!! This is work-in-progress library, breaking changes are expected !!!**

<p align="center">
<img src="moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

Moost is a Metadata driven Web App Framework inspired by [nestjs](https://nestjs.com/) and powered by [wooks](https://github.com/wooksjs/wooksjs).

The main ideas behind Moost are:
1. Use the power of TS decorators to describe your app
2. Use the power of [wooks](https://github.com/wooksjs/wooksjs) to process events
3. Make it easier to control dependency injections
4. Use as less external dependencies as possible

What's the difference to [nestjs](https://nestjs.com/)?
1. It does not use additional `modules` abstraction
2. It utilizes reusable dependency injection framework [@prostojs/infact](https://github.com/prostojs/infact)
3. It uses metadata layer powered by [@prostojs/mate](https://github.com/prostojs/mate)
4. It supports DTOs and validations powered by [@prostojs/valido](https://github.com/prostojs/valido)
5. It does not use express or fastify (although you can use express/fastify with an adapter)
6. Currently it does not support any of additional techniques (like ORMs, Queues etc.)

## [Documentation](https://github.com/moostjs/moostjs/tree/main/packages/moost)
