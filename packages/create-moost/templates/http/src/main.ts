import { MoostHttp } from "@moostjs/event-http";
//=IF (ws)
import { MoostWs } from "@moostjs/event-ws";
//=END IF
//=IF (wf)
import { MoostWf } from "@moostjs/event-wf";
//=END IF
import { Moost } from "moost";

import { AppController } from "./controllers/app.controller";
//=IF (ws)
import { WsController } from "./controllers/ws.controller";
//=END IF
//=IF (wf)
import { WfController } from "./workflow/wf.controller";
//=END IF

const app = new Moost();

// Configure the HTTP adapter and start listening on port 3000
const http = new MoostHttp();
app.adapter(http).listen(3000, () => {
  app.getLogger("[{{ projectName }}]").info("Server started on port 3000");
});

//=IF (ws)
// Configure the WebSocket adapter integrated with the HTTP server
app.adapter(new MoostWs({ httpApp: http }));
//=END IF

//=IF (wf)
// Configure the Workflow adapter to handle workflow-related events
app.adapter(new MoostWf());
//=END IF

// Register application controllers
//=IF (wf && ws)
app.registerControllers(AppController, WsController, WfController).init();
//=END IF
//=IF (wf && !ws)
app.registerControllers(AppController, WfController).init();
//=END IF
//=IF (!wf && ws)
app.registerControllers(AppController, WsController).init();
//=END IF
//=IF (!wf && !ws)
app.registerControllers(AppController).init();
//=END IF
