/**
 * @file Main Entry Point for Moost Application Template
 *
 * This file serves as the primary entry point for the Moost application.
 *
 * For more details on Moost Webapp and Moost Workflows, visit:
 * - Moost Webapp: https://moost.org/webapp/
 * - Moost Workflows: https://moost.org/wf/
 */

import { MoostHttp } from "@moostjs/event-http";
//=IF (wf)
import { MoostWf } from "@moostjs/event-wf";
//=END IF
import { Moost } from "moost";

import { AppController } from "./controllers/app.controller";
//=IF (wf)
import { WfController } from "./workflow/wf.controller";
//=END IF

/**
 * Initializes and configures the Moost application.
 *
 * The application performs the following steps:
 * 1. Creates a new instance of the Moost application.
 * 2. Sets up the moost adapters.
 * 3. Registers controllers.
 * 4. Initializes the application to start handling incoming events.
 */
const app = new Moost();

// Configure the HTTP adapter and start listening on port 3000
app.adapter(new MoostHttp()).listen(3000, () => {
  app.getLogger("[{{ projectName }}]").info("Server started on port 3000");
});

//=IF (wf)
// Configure the Workflow adapter to handle workflow-related events
app.adapter(new MoostWf());
//=END IF

// Register application controllers
//=IF (wf)
app.registerControllers(AppController, WfController).init();
//=END IF
//=IF (!wf)
app.registerControllers(AppController).init();
//=END IF
