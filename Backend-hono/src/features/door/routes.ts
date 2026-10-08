import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import authenticateDevice from "../../middleware/authenticateDevice";
import {
  manualDoorUnlockController,
  pollDeviceCommandController,
} from "./controller";

const doorRoutes = new Hono();

doorRoutes.post("/unlock", authenticate, manualDoorUnlockController);
doorRoutes.get("/commands", authenticateDevice, pollDeviceCommandController);
export default doorRoutes;
