import {env} from "./config/env.js";
import {createPrismaClient} from "./config/prisma.js";
import {createApp} from "./app.js";

const prisma = createPrismaClient();
const app = createApp({db: prisma});
const server = app.listen(env.PORT, () => {
  console.info(`MITHAS API listening on port ${env.PORT}`);
});

let isClosing = false;

async function shutdown(signal) {
  if (isClosing) return;
  isClosing = true;
  console.info(`${signal} received; shutting down`);

  server.close(async error => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Database shutdown failed", disconnectError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
