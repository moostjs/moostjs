/**
 * @file Workflow Controller for Moost Workflow Template
 *
 * This file defines the `WfController` class, which orchestrates the workflow
 * steps using the Moost Workflow (MoostWf) framework. The controller manages
 * the workflow's context, handles user inputs, sends and verifies one-time codes (OTC),
 * updates the database, and produces the final output.
 *
 * **Important:** This example is a simplified demonstration. A production implementation
 * would involve more complex logic, robust error handling, secure key management,
 * and integration with persistent storage systems.
 *
 * For more information on Moost Workflows, visit: https://moost.org/wf/
 */

import {
  Step,
  Workflow,
  WorkflowParam,
  WorkflowSchema,
} from "@moostjs/event-wf";
import { Controller, EventLogger, Injectable, InjectEventLogger } from "moost";

import type {
  TWfExampleContext,
  TWfExampleInput,
  TWfExampleInputSchema,
} from "./wf.types";
import { wfInputsSchema } from "./wf.types";

/**
 * `WfController` manages the workflow steps for the example workflow "wf-example".
 *
 * It handles user inputs, conditional steps based on context, sending and checking
 * one-time codes, updating the database, and generating the final output greeting.
 */
@Injectable("FOR_EVENT")
@Controller()
export class WfController {
  /**
   * The workflow context that holds all necessary data throughout the workflow lifecycle.
   *
   * @type {TWfExampleContext}
   */
  @WorkflowParam("context")
  ctx!: TWfExampleContext;

  /**
   * Defines the entry point for the workflow "wf-example" and its schema.
   *
   * The workflow schema outlines the sequence of steps and any conditional logic
   * based on the workflow context.
   *
   * **Workflow Steps:**
   * 1. `inputs` - Collect user inputs.
   * 2. `get_supervisor_email` - Conditionally collect supervisor email if age < 18.
   * 3. `send_otc` - Send a one-time code to the user's email.
   * 4. `check_otc` - Verify the received one-time code.
   * 5. `update_db` - Update the database with the user's information.
   * 6. `output` - Generate a greeting message.
   *
   * **Note:** This workflow schema is a simplified demonstration. A production workflow
   * would require more comprehensive validation, error handling, and possibly additional steps.
   */
  @Workflow("wf-example")
  @WorkflowSchema<TWfExampleContext>([
    "inputs",
    { id: "get_supervisor_email", condition: (ctx) => (ctx.age ?? 0) < 18 },
    "send_otc",
    "check_otc",
    "update_db",
    "output",
  ])
  entry() {
    // Entry point for the workflow. The actual implementation is managed by MoostWf.
  }

  /**
   * Handles the "inputs" step of the workflow.
   *
   * This step collects user inputs such as name, email, password, and age. It validates
   * that all required fields are provided. If any fields are missing, it prompts the user
   * to provide the necessary inputs.
   *
   * @param {TWfExampleInput} [input] - The input data provided by the user.
   * @returns {TWfExampleInputSchema | void} - Returns input schema requirements if validation fails.
   */
  @Step("inputs")
  inputs(@WorkflowParam("input") input?: TWfExampleInput) {
    // Validate required inputs: name, email, password, age
    if (!input?.name || !input.email || !input.password || !input.age) {
      console.log({ input });
      return this.getInputsRequired({
        fields: ["name", "email", "password", "age"],
        values: input,
        errorMessage: input ? "Please fill in all the fields" : "",
      });
    }

    // Populate the workflow context with validated inputs
    this.ctx.name = input.name as string;
    this.ctx.email = input.email as string;
    this.ctx.password = input.password as string;
    this.ctx.age = input.age as number;
  }

  /**
   * Handles the "get_supervisor_email" step of the workflow.
   *
   * This step is conditionally executed if the user's age is below 18. It collects
   * the supervisor's email address to ensure that an underage user has appropriate oversight.
   *
   * @param {TWfExampleInput} [input] - The input data provided by the user.
   * @returns {TWfExampleInputSchema | void} - Returns input schema requirements if validation fails.
   */
  @Step("get_supervisor_email")
  supervisorEmail(@WorkflowParam("input") input?: TWfExampleInput) {
    // Validate supervisorEmail input for underage users
    if (!input?.supervisorEmail) {
      return this.getInputsRequired({
        message: "Underage person must input supervisor email",
        fields: ["supervisorEmail"],
        values: input,
      });
    }
  }

  /**
   * Handles the "send_otc" step of the workflow.
   *
   * This step generates a one-time code (OTC) and logs its dispatch. In a real-world
   * scenario, the OTC would be sent to the user's email address.
   *
   * @param {EventLogger} logger - The event logger instance for logging purposes.
   */
  @Step("send_otc")
  sendOtc(@InjectEventLogger() logger: EventLogger) {
    // Generate a simple 4-digit one-time code (OTC)
    this.ctx.otcSent = `0000${String(Math.random() * 9999)}`.slice(-4);
    logger.log(`OTC sent: ${this.ctx.otcSent}`);
    // **Note:** In production, send the OTC via a secure channel (e.g., email or SMS)
  }

  /**
   * Handles the "check_otc" step of the workflow.
   *
   * This step verifies that the OTC received from the user matches the one sent.
   * If the OTC is invalid or missing, it prompts the user to re-enter it.
   *
   * @param {TWfExampleInput} [input] - The input data provided by the user.
   * @returns {TWfExampleInputSchema | void} - Returns input schema requirements if validation fails.
   */
  @Step("check_otc")
  check(@WorkflowParam("input") input?: TWfExampleInput) {
    // Validate the received OTC against the sent OTC
    if (!input?.otcReceived || input.otcReceived !== this.ctx.otcSent) {
      return this.getInputsRequired({
        message: "One Time Code has been sent (check logs)",
        fields: ["otcReceived"],
        values: input,
        errorMessage: input?.otcReceived ? "OTC is invalid" : "",
      });
    }
    this.ctx.otcReceived = input.otcReceived;
  }

  /**
   * Handles the "update_db" step of the workflow.
   *
   * This step is responsible for updating the database with the user's information.
   * In this demonstration, the implementation is left as a placeholder.
   *
   * **Note:** In a production environment, implement secure and reliable database operations here.
   */
  @Step("update_db")
  updateDb() {
    // Placeholder for database update logic
    // **Example:** Save user information to the database
    // this.database.saveUser(this.ctx);
  }

  /**
   * Handles the "output" step of the workflow.
   *
   * This final step generates a greeting message for the user based on the collected data.
   */
  @Step("output")
  outputs() {
    this.ctx.greeting = `Welcome ${this.ctx.name}!`;
  }

  /**
   * Generates the required input schema based on the specified options.
   *
   * This helper method constructs the input schema required to prompt the user for
   * necessary inputs. It filters the predefined `wfInputsSchema` based on the
   * specified fields and populates them with existing values from the workflow context.
   *
   * @param {Object} options - Configuration options for generating input schema.
   * @param {string} [options.message] - An optional message to display on the input form.
   * @param {Array<keyof TWfExampleContext>} options.fields - The fields to include in the input form.
   * @param {TWfExampleInput} [options.values] - The current input values to pre-populate the form.
   * @param {string} [options.errorMessage] - An optional error message to display if validation fails.
   * @returns {Object} An object containing the `inputRequired` schema.
   */
  getInputsRequired(options: {
    message?: string;
    fields: Array<keyof TWfExampleContext>;
    values?: TWfExampleInput;
    errorMessage?: string;
  }): { inputRequired: TWfExampleInputSchema } {
    const inputs = [] as TWfExampleInputSchema["inputs"];
    for (const field of options.fields) {
      const schema = wfInputsSchema.find((f) => f.name === field);
      if (schema) {
        inputs.push({
          ...schema,
          value: (options.values?.[field] || this.ctx[field]) as string,
        });
      }
    }
    return {
      inputRequired: {
        inputs,
        message: options.message,
        errorMessage: options.errorMessage,
      },
    };
  }
}
