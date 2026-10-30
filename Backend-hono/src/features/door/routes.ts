import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import authenticateDevice from "../../middleware/authenticateDevice";
import authenticateSse from "../../middleware/authenticateSse";
import {
  manualDoorUnlockController,
  pollDeviceCommandController,
  reportAccessController,
  streamAccessEventsController,
} from "./controller";
import { reportJobProgressController } from "../fingerprints/controller";

const doorRoutes = new Hono();

doorRoutes.post("/unlock", authenticate, manualDoorUnlockController);
doorRoutes.get("/commands", authenticateDevice, pollDeviceCommandController);
doorRoutes.post("/access", authenticateDevice, reportAccessController);
doorRoutes.get("/stream", authenticateSse, streamAccessEventsController);
doorRoutes.post("/jobs/:jobId/progress", authenticateDevice, reportJobProgressController);
export default doorRoutes;
