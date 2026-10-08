import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import authenticateDevice from "../../middleware/authenticateDevice";
import {
  manualDoorUnlockController,
  pollDeviceCommandController,
  reportAccessController,
} from "./controller";

const doorRoutes = new Hono();

doorRoutes.post("/unlock", authenticate, manualDoorUnlockController);
doorRoutes.get("/commands", authenticateDevice, pollDeviceCommandController);
doorRoutes.post("/access", authenticateDevice, reportAccessController);
export default doorRoutes;
