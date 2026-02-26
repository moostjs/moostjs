/**
 * @file Workflow to HTML Page Interceptor for Moost Workflow Template
 *
 * This module defines the `Wf2HtmlPageInterceptor` class, which serves as an interceptor
 * for MoostHttp handler. The interceptor is responsible for
 * converting workflow outputs into HTML pages with forms, enabling workflows to execute,
 * pause for user inputs, and maintain context in an encrypted state property.
 *
 * **Important:** This example is highly simplified and intended solely for demonstration
 * purposes. A production implementation would require more robust error handling,
 * secure key management, and comprehensive validation mechanisms.
 *
 * The interceptor performs the following key functions:
 * - Decrypts the workflow state received from the frontend.
 * - Processes the workflow response to render appropriate HTML pages for user interaction.
 * - Encrypts the updated workflow state before sending it back to the frontend.
 *
 * For more information on Moost Workflows, visit https://moost.org/wf/
 */

import { Body } from "@moostjs/event-http";
import type { TFlowOutput } from "@moostjs/event-wf";
import type { TOvertakeFn } from "moost";
import { After, Before, Intercept, Interceptor, Overtake, Response } from "moost";

import { decryptState, encryptState } from "./wf.encrypt";
import type {
  TWfExampleContext,
  TWfExampleInput,
  TWfExampleInputSchema,
  TWfState,
} from "./wf.types";

/**
 * `Wf2HtmlPageInterceptor` intercepts http handlers to transform workflow outputs
 * into HTML pages, facilitating user interactions through forms.
 *
 * This interceptor handles the encryption and decryption of the workflow state to ensure
 * secure transmission between the backend and frontend.
 */
@Interceptor(undefined, "FOR_EVENT")
class Wf2HtmlPageInterceptor {
  @Body()
  input?: TWfExampleInput & { wfState: string | TWfState | undefined };

  /**
   * Pre-processing: decrypts the workflow state if it is a string,
   * or clears it if it is not.
   */
  @Before()
  decryptState() {
    if (typeof this.input?.wfState === "string") {
      this.input.wfState = decryptState(this.input.wfState);
    } else if (this.input) {
      this.input.wfState = undefined;
    }
  }

  /**
   * Post-processing: renders an HTML input form or final output page
   * based on the workflow response.
   */
  @After()
  renderOutput(@Response() response: unknown, @Overtake() reply: TOvertakeFn) {
    const wfOutput = response as TFlowOutput<
      TWfExampleContext,
      TWfExampleInput,
      TWfExampleInputSchema
    >;

    if (wfOutput.inputRequired) {
      reply(
        renderInputPage(wfOutput.inputRequired, encryptState(wfOutput.state))
      );
    }
    if (wfOutput.finished) {
      reply(renderOutputPage(wfOutput.state.context));
    }
  }
}

/**
 * Factory function to create an interceptor decorator for the `Wf2HtmlPageInterceptor`.
 *
 * @returns {Function} The interceptor decorator.
 */
export const Wf2HtmlPage = () => Intercept(Wf2HtmlPageInterceptor);

/**
 * SVG path data for the Moost logo used in the HTML pages.
 *
 * @type {string}
 */
const moostLogo =
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M126 71H127.5C137.717 71 146 79.2827 146 89.5C146 99.7173 137.717 108 127.5 108H126C120.942 117.021 113.089 122 103.012 122H127.5C145.449 122 160 107.449 160 89.5C160 71.5507 145.449 57 127.5 57H103.012C113.089 57 120.942 61.9792 126 71ZM103.012 71L89 57H87.5C69.5507 57 55 71.5507 55 89.5C55 107.449 69.5507 122 87.5 122H89L103.012 108H87.5C77.2827 108 69 99.7173 69 89.5C69 79.2827 77.2827 71 87.5 71H103.012Z" fill="#FF269B"/>';

/**
 * Renders the HTML page for user inputs.
 *
 * This function generates an HTML form based on the required inputs from the workflow.
 * It includes the necessary fields, messages, error messages, and the encrypted workflow state.
 *
 * **Note:** This implementation is simplified for demonstration purposes.
 *
 * @param {TWfExampleInputSchema} inputRequired - The schema defining required inputs.
 * @param {string} [state=''] - The encrypted workflow state to be included as a hidden field.
 * @returns {string} The rendered HTML string for the input page.
 */
function renderInputPage(
  inputRequired: TWfExampleInputSchema,
  state = ""
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Moost Workflows Example</title>
        <link rel="preload stylesheet" href="/static/wf.css" as="style">
    </head>
    <body>
        <section>
        <h1>
        <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${moostLogo}
        <rect x="27" y="64" width="91" height="51" rx="25.5" stroke="#FF269B" stroke-width="14"/>
        </svg>
        Workflows Example
        </h1>
        <form method="POST" action="/wf">
        ${renderMessage(inputRequired.message)}
        <input type="hidden" name="wfState" value="${state}" />
        ${inputRequired.inputs.map((i) => renderInput(i)).join("\n")}
        ${renderError(inputRequired.errorMessage)}
        <button type="submit">Submit</button>
        <a href="https://moost.org/wf/" target="_blank">Moost WF Documentation</a>
        </form>
        </section>
    </body>
    </html>
`;
}

/**
 * Renders an optional message within the HTML page.
 *
 * @param {string} [message] - The message to be displayed.
 * @returns {string} The rendered HTML string for the message.
 */
function renderMessage(message?: string): string {
  return message ? `<p>${message}</p>` : "";
}

/**
 * Renders an optional error message within the HTML page.
 *
 * @param {string} [message] - The error message to be displayed.
 * @returns {string} The rendered HTML string for the error message.
 */
function renderError(message?: string): string {
  return message ? `<p class="error">${message}</p>` : "";
}

/**
 * Renders the final output HTML page after workflow completion.
 *
 * This function generates an HTML page displaying the user's greeting, email, and age.
 *
 * **Note:** This implementation is simplified for demonstration purposes.
 *
 * @param {TWfExampleContext} ctx - The workflow context containing user data.
 * @returns {string} The rendered HTML string for the output page.
 */
function renderOutputPage(ctx: TWfExampleContext): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Moost Workflows Example</title>
        <link rel="preload stylesheet" href="/static/wf.css" as="style">
    </head>
    <body>
        <section>
        <h1>
        <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${moostLogo}
        <rect x="27" y="64" width="91" height="51" rx="25.5" stroke="#FF269B" stroke-width="14"/>
        </svg>
        Workflows Example
        </h1>
        <h2>${ctx.greeting}</h2>
        <p>Your email is ${ctx.email}</p>
        <p>Your age is ${ctx.age}</p>

        <a href="https://moost.org/wf/" target="_blank">Moost WF Documentation</a>
        </section>
    </body>
    </html>
        `;
}

/**
 * Renders an individual input field within the HTML form.
 *
 * This function generates the HTML string for a single input field based on its schema.
 *
 * @param {TWfExampleInputSchema['inputs'][number]} input - The input schema item.
 * @returns {string} The rendered HTML string for the input field.
 */
function renderInput(input: TWfExampleInputSchema["inputs"][number]): string {
  return `<label>${input.label}<input type="${input.type}" name="${
    input.name
  }" value="${input.value || ""}" /></label>`;
}
