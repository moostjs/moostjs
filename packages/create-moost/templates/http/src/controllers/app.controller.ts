/**
 * @file Application Controller for Moost HTTP Template
 *
 * This file defines the `AppController` class, which handles HTTP routes within the
 * Moost framework. The controller manages http endpoints.
 *
 * For more information on Moost HTTP, visit https://moost.org/webapp/
 */

import { Body, Get, Post, SetHeader } from "@moostjs/event-http";
//=IF (wf)
import { MoostWf } from "@moostjs/event-wf";
import { serveFile } from "@wooksjs/http-static";
//=END IF
import { Controller, Param } from "moost";


//=IF (wf)
import type {
  TWfExampleContext,
  TWfExampleInput,
  TWfExampleInputSchema,
  TWfState,
} from "../workflow/wf.types";
import { Wf2HtmlPage } from "../workflow/wf2html.interceptor";
//=END IF

/**
 * `AppController` manages the application's HTTP routes.
 */
@Controller()
export class AppController {
//=IF (wf)
  constructor(
    private readonly wf: MoostWf<TWfExampleContext, TWfExampleInputSchema>
  ) {}
//=END IF

  /**
   * Handles GET requests to the `/hello/:name` endpoint.
   *
   * Responds with a personalized greeting message.
   *
   * **Example:**
   * - Request: `GET /hello/John`
   * - Response: `Hello John`
   *
   * @param {string} name - The name parameter extracted from the URL.
   * @returns {string} A greeting message.
   */
  @Get("hello/:name")
  hello(@Param("name") name: string): string {
    return `Hello ${name}`;
  }

//=IF (wf)
  /**
   * Handles both GET and POST requests to the `/wf` endpoint.
   *
   * This endpoint is responsible for starting or resuming workflows based on the
   * provided workflow state and user inputs. It utilizes the `Wf2HtmlPage` interceptor
   * to convert workflow outputs into HTML pages with forms for user interaction.
   *
   * @param {TWfExampleInput | undefined} formInput - The input data from the request body.
   * @returns {Promise<any>} The workflow's response, rendered as an HTML page.
   */
  @Get("wf")
  @Post("wf")
  @SetHeader("content-type", "text/html")
  @Wf2HtmlPage()
  async startWf(@Body() formInput?: TWfExampleInput) {
    const { wfState, ...rest } = formInput || {};
    const input = formInput ? rest : undefined;

    if (typeof wfState === "object") {
      // Resume an existing workflow with the provided state and input
      return this.wf.resume<TWfExampleInput>(wfState as TWfState, input);
    }

    // Start a new workflow with the provided input
    return this.wf.start<TWfExampleInput>("wf-example", {}, input);
  }

  /**
   * Serves static files from the `/static` directory.
   *
   * Handles GET requests to the `/static/*` endpoint by serving the requested file.
   *
   * **Example:**
   * - Request: `GET /static/wf.css`
   * - Response: Serves the `wf.css` file from the `./src/static/` directory.
   *
   * @param {string} filePath - The path to the static file requested.
   * @returns {Promise<Buffer | string>} The contents of the requested static file.
   */
  @Get("static/*")
  async serveStaticFile(@Param("*") filePath: string) {
    return serveFile(`./src/static/${filePath}`, {
      cacheControl: { maxAge: '1d' },
    });
  }
//=END IF
}
