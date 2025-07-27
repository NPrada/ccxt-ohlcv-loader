import { cronSyncData } from "./src/server/cron-sync";
import { setupServer } from "./src/utils/setup-server";
import { env } from "./src/env";
import { FastifyBaseLogger, FastifyInstance } from "fastify";

const {
  logger,
  server,
}: {
  server: FastifyInstance;
  logger: FastifyBaseLogger;
} = setupServer(cronSyncData, env);

export { logger, server };

process.on("uncaughtException", async (err) => {
  logger.fatal("uncaughtException");
  logger.error(err);
});

process.on("unhandledRejection", async (err) => {
  logger.fatal("unhandledRejection");
  logger.error(err);
});