---
name: moostjs-event-http
description: Use this skill when working with @moostjs/event-http — to create an HTTP server with MoostHttp adapter, register route handlers with @Get()/@Post()/@Put()/@Delete()/@Patch()/@All(), extract request data with @Query(), @Header(), @Cookie(), @Body(), @RawBody(), @Authorization(), @Url(), @Method(), @Req(), @Res(), @ReqId(), @Ip(), @IpList(), control responses with @SetHeader(), @SetCookie(), @SetStatus(), @StatusRef(), @HeaderRef(), @CookieRef(), @CookieAttrsRef(), throw HTTP errors with HttpError, enforce body limits with @BodySizeLimit()/@CompressedBodySizeLimit()/@BodyReadTimeoutMs(), define auth guards with defineAuthGuard()/AuthGuard/Authenticate, or handle WebSocket upgrades with @Upgrade().
---

# @moostjs/event-http

Moost HTTP adapter — decorator-driven HTTP server built on `@wooksjs/event-http`. Provides route decorators, request data extractors, response control, auth guards, and body limits for Moost applications.

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](core.md) | Starting a new project, understanding the mental model, configuring MoostHttp adapter |
| Routing & handlers | [routing.md](routing.md) | Defining routes with @Get/@Post/etc, route parameters, wildcards, path patterns |
| Request data | [request.md](request.md) | Extracting query params, headers, cookies, body, auth, IP, URL from requests |
| Response control | [response.md](response.md) | Setting status codes, headers, cookies, error handling, raw response access |
| Authentication | [auth.md](auth.md) | Auth guards, credential extraction, bearer/basic/apiKey/cookie transports, @Authenticate |

## Quick reference

```ts
// Imports
import { MoostHttp, Get, Post, Put, Delete, Patch, All, HttpMethod, Upgrade } from '@moostjs/event-http'
import { Query, Header, Cookie, Body, RawBody, Authorization, Url, Method, Req, Res, ReqId, Ip, IpList } from '@moostjs/event-http'
import { SetHeader, SetCookie, SetStatus, StatusRef, HeaderRef, CookieRef, CookieAttrsRef } from '@moostjs/event-http'
import { BodySizeLimit, CompressedBodySizeLimit, BodyReadTimeoutMs } from '@moostjs/event-http'
import { Authenticate, AuthGuard, defineAuthGuard, HttpError } from '@moostjs/event-http'
import { Controller, Param, Params } from 'moost'
```
