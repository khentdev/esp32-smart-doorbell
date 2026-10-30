import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import {
  deleteFingerprintController,
  enrollFingerprintController,
  listFingerprintsController,
  renameFingerprintController,
} from "./controller";

const fingerprintRoutes = new Hono();

fingerprintRoutes.get("/", authenticate, listFingerprintsController);
fingerprintRoutes.post("/", authenticate, enrollFingerprintController);
fingerprintRoutes.patch("/:id", authenticate, renameFingerprintController);
fingerprintRoutes.delete("/:id", authenticate, deleteFingerprintController);

export default fingerprintRoutes;
