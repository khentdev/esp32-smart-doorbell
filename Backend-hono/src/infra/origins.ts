import { env } from "../config/env";

const getRequestsOrigin = () => {
  if (Bun.env.NODE_ENV === "development") {
    return [
      env.FRONTEND_DEV_URL,
      "http://localhost:5173",
      "http://localhost:4173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:4173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
  }

  return [Bun.env.FRONTEND_PROD_URL];
};

export default getRequestsOrigin;
