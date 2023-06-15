import { Get, HeaderHook, SetHeader, StatusHook, Url } from '@moostjs/event-http'
import { Controller, Moost, Const, useControllerContext, useEventLogger } from 'moost'
import { getAbsoluteFSPath  } from 'swagger-ui-dist'
import { serveFile } from '@wooksjs/http-static'
import { THeaderHook, TStatusHook } from '@wooksjs/event-http'
import { join } from 'path'
import { SwaggerExclude } from './decorators'
import { mapToSwaggerSpec } from './mapping'
import { ZodSkip } from '@moostjs/zod'

@SwaggerExclude()
@ZodSkip()
@Controller('api-docs')
export class SwaggerController {
    constructor(@Const('Moost API') protected title = 'Moost API') {}

    assetPath = getAbsoluteFSPath()

    @Get('')
    @Get('//')
    @Get('index.html')
    @SetHeader('content-type', 'text/html')
    serveIndex(@Url() url: string, @HeaderHook('location') location: THeaderHook, @StatusHook() status: TStatusHook) {
        if (!url.endsWith('index.html') && !url.endsWith('/')) {
            status.value = 302
            location.value = join(url, '/')
            return ''
        }

        return`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
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
    layout: "StandaloneLayout"
  });
};`
    }

    spec?: Record<string, unknown>

    @Get()
    async 'spec.json'() {
        const logger = useEventLogger('@moostjs/zod')
        // if (!this.spec) {
        const { instantiate } = useControllerContext()
        const moost = await instantiate(Moost)
        this.spec = mapToSwaggerSpec(moost.getControllersOverview(), { title: this.title }, logger)
        // }
        return this.spec
    }

    @Get('swagger-ui-bundle.js')
    @Get('swagger-ui-standalone-preset.js')
    @Get('swagger-ui.css')
    @Get('index.css')
    files(@Url() url: string) {
        return this.serve(url.split('/').pop() as string)
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
