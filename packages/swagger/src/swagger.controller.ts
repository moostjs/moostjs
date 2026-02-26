import type { THeaderHook, TStatusHook } from '@moostjs/event-http'
import { Get, HeaderHook, SetHeader, StatusHook, Url } from '@moostjs/event-http'
import { useResponse } from '@wooksjs/event-http'
import { serveFile } from '@wooksjs/http-static'
import { Const, Controller, current, Moost, useControllerContext, useLogger } from 'moost'
import Path from 'path'
import { getAbsoluteFSPath } from 'swagger-ui-dist'

import { SwaggerExclude } from './decorators'
import { jsonToYaml } from './json-to-yaml'
import { mapToSwaggerSpec } from './mapping'
import type { TSwaggerOptions } from './mapping'

/** Serves the Swagger UI, spec.json, and spec.yaml under the `/api-docs` route prefix. */
@SwaggerExclude()
@Controller('api-docs')
export class SwaggerController {
  constructor(
    @Const({ title: 'Moost API' }) protected opts: TSwaggerOptions = { title: 'Moost API' },
  ) {}

  'assetPath' = getAbsoluteFSPath()

  protected processCors() {
    if (this.opts.cors) {
      useResponse().enableCors(this.opts.cors === true ? undefined : this.opts.cors)
    }
  }

  @Get('')
  @Get('//')
  @Get('index.html')
  @SetHeader('content-type', 'text/html')
  serveIndex(
    @Url() url: string,
    @HeaderHook('location') location: THeaderHook,
    @StatusHook() status: TStatusHook,
  ) {
    this.processCors()
    if (!url.endsWith('index.html') && !url.endsWith('/')) {
      status.value = 302
      location.value = Path.join(url, '/')
      return ''
    }

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${this.opts.title}</title>
    <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
    <link rel="stylesheet" type="text/css" href="index.css" />
    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />
  </head>

  <body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js" charset="UTF-8"> </script>
    <script src="./swagger-ui-standalone-preset.js" charset="UTF-8"> </script>
    <script src="./swagger-initializer.js" charset="UTF-8"> </script>
  </body>
</html>`
  }

  @Get()
  @SetHeader('content-type', 'application/javascript')
  'swagger-initializer.js'() {
    this.processCors()
    return `window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: "./spec.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "BaseLayout"
  });
};`
  }

  'spec'?: Record<string, unknown>

  protected async resolveSpec() {
    if (!this.spec) {
      const ctx = current()
      const l = useLogger(ctx)
      const logger = typeof l.topic === 'function' ? l.topic('@moostjs/swagger') : l
      const { instantiate } = useControllerContext(ctx)
      const moost = await instantiate(Moost)
      this.spec = mapToSwaggerSpec(moost.getControllersOverview(), this.opts, logger)
    }
    return this.spec
  }

  @Get()
  async 'spec.json'() {
    this.processCors()
    return this.resolveSpec()
  }

  @Get()
  @SetHeader('content-type', 'text/yaml')
  async 'spec.yaml'() {
    this.processCors()
    return jsonToYaml(await this.resolveSpec())
  }

  @Get('swagger-ui-bundle.*(js|js\\.map)')
  @Get('swagger-ui-standalone-preset.*(js|js\\.map)')
  @Get('swagger-ui.*(css|css\\.map)')
  @Get('index.*(css|css\\.map)')
  files(@Url() url: string) {
    this.processCors()
    return this.serve(url.split('/').pop()!)
  }

  serve(path: string) {
    return serveFile(path, {
      baseDir: this.assetPath,
      cacheControl: {
        public: true,
        maxAge: '1w',
      },
    })
  }
}
