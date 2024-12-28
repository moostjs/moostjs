/**
 * @file Workflow Types Definition for Moost Workflow Template
 *
 * This file defines the TypeScript interfaces and types used to manage the workflow
 * context, inputs, and input schemas within the Moost Workflow (MoostWf) framework.
 * Given that MoostWf is a highly generic workflow handler, it's essential to tailor
 * the workflow context and input schemas according to the specific use cases and
 * application patterns of your project.
 *
 * The defined types include:
 * - `TWfExampleContext`: Represents the workflow's context, storing necessary data
 *   throughout the workflow's lifecycle.
 * - `TWfExampleInput`: Defines the structure of inputs that the workflow accepts.
 * - `TWfExampleInputSchemaItem` & `TWfExampleInputSchema`: Describe the schema for
 *   input forms, detailing each input field's properties such as label, name, type,
 *   and options.
 * - `TWfState`: Represents the state of the workflow, derived from Moost's `TFlowOutput`.
 *
 * Additionally, the `wfInputsSchema` constant provides a predefined schema for workflow
 * inputs, facilitating the generation of HTML forms for user interactions.
 *
 * For more information on Moost Workflows, visit: https://moost.org/wf/
 */

import { TFlowOutput } from "@moostjs/event-wf";

/**
 * Defines the structure of the workflow's context.
 *
 * The workflow context holds all the necessary data that persists throughout the
 * execution of the workflow. This includes user information, authentication details,
 * and any other relevant state required for the workflow's operations.
 */
export interface TWfExampleContext {
  /** The name of the user. */
  name?: string;

  /** The email address of the user. */
  email?: string;

  /** The email address of the user's supervisor. */
  supervisorEmail?: string;

  /** Indicates whether a one-time code (OTC) has been sent. */
  otcSent?: string;

  /** The received one-time code (OTC) from the user. */
  otcReceived?: string;

  /** The user's password. */
  password?: string;

  /** The age of the user. */
  age?: number;

  /** A greeting message for the user. */
  greeting?: string;
}

/**
 * Defines the structure of the workflow's input.
 *
 * `TWfExampleInput` is a generic type that maps string keys to values of various
 * types, including strings, numbers, undefined, or objects. This flexibility allows
 * the workflow to handle diverse input data based on different use cases.
 */
export type TWfExampleInput = Record<
  string,
  string | number | undefined | object
>;

/**
 * Represents a single item within the workflow's input schema.
 *
 * Each `TWfExampleInputSchemaItem` defines the properties of an input field
 * that will be rendered in the HTML form. This includes the label, name, type,
 * and any additional options for select-type inputs.
 */
export interface TWfExampleInputSchemaItem {
  /** The display label for the input field. */
  label: string;

  /** The unique name identifier for the input field. */
  name: string;

  /** The type of the input field (e.g., text, number, select, password). */
  type: "text" | "number" | "select" | "password";

  /** Optional array of options for select-type input fields. */
  options?: Array<{
    /** The display label for the option. */
    label: string;

    /** The value associated with the option. */
    value: string;
  }>;

  /** The default value of the input field, if any. */
  value?: string | number;
}

/**
 * Defines the schema for the workflow's input form.
 *
 * `TWfExampleInputSchema` aggregates multiple `TWfExampleInputSchemaItem` objects
 * to define the complete structure of the input form. It may also include optional
 * messages or error messages to be displayed to the user.
 */
export interface TWfExampleInputSchema {
  /** An array of input schema items defining each form field. */
  inputs: TWfExampleInputSchemaItem[];

  /** An optional message to be displayed on the form. */
  message?: string;

  /** An optional error message to be displayed if form validation fails. */
  errorMessage?: string;
}

/**
 * Represents the state of the workflow.
 *
 * `TWfState` is derived from Moost's `TFlowOutput` and encapsulates the current
 * state of the workflow, including the context, inputs, and input schema.
 */
export type TWfState = TFlowOutput<
  TWfExampleContext,
  TWfExampleInput,
  TWfExampleInputSchema
>["state"];

/**
 * Defines the input schema for the workflow's HTML form.
 *
 * `wfInputsSchema` is an array of `TWfExampleInputSchemaItem` objects that specify
 * the fields to be rendered in the HTML form. This schema is used by the `Wf2HtmlPage`
 * interceptor to generate dynamic forms based on the workflow's requirements.
 */
export const wfInputsSchema: TWfExampleInputSchemaItem[] = [
  {
    label: "Name",
    name: "name",
    type: "text",
    value: undefined,
  },
  {
    label: "Email",
    name: "email",
    type: "text",
    value: undefined,
  },
  {
    label: "Password",
    name: "password",
    type: "password",
    value: undefined,
  },
  {
    label: "Age",
    name: "age",
    type: "number",
    value: undefined,
  },
  {
    label: "One Time Code",
    name: "otcReceived",
    type: "text",
    value: undefined,
  },
  {
    label: "Supervisor Email",
    name: "supervisorEmail",
    type: "text",
    value: undefined,
  },
];
