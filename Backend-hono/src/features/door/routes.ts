import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import { manualDoorUnlockController } from "./controller";

const doorRoutes = new Hono();

doorRoutes.post("/unlock", authenticate, manualDoorUnlockController);
export default doorRoutes;
