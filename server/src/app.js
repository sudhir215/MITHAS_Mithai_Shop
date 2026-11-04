import cors from "cors";
import express from "express";
import helmet from "helmet";
import {env} from "./config/env.js";
import {createPrismaClient} from "./config/prisma.js";
import {errorHandler, notFoundHandler} from "./middleware/errorHandler.js";
import adminRouter from "./routes/adminRoutes.js";
import {createLoginRateLimiter} from "./middleware/adminAuth.js";
import catalogRouter from "./routes/catalogRoutes.js";
import healthRouter from "./routes/healthRoutes.js";

export function createApp({db, logger = console, loginRateLimit} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.locals.db = db ?? createPrismaClient();
  app.locals.logger = logger;
  app.locals.loginRateLimiter = createLoginRateLimiter(loginRateLimit);

  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      error.code = "CORS_ORIGIN_DENIED";
      callback(error);
    },
  }));
  app.use(express.json({limit: "1mb"}));

  app.use("/api/health", healthRouter);
  app.use("/api", catalogRouter);
  app.use("/api/admin", adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
