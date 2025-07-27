import Fastify, { FastifyBaseLogger, FastifyInstance } from "fastify";
import fastifyCron, { FalsyValue, Params } from "fastify-cron";
import { envToLogger } from "./logger-config";

type CronJobVal = Params | FalsyValue;

function registerCronJobs(cronJobs: CronJobVal[], server: FastifyInstance) {
  server.register(fastifyCron, {
    jobs: cronJobs,
  });
}

const routes = (server: FastifyInstance) => {
  server.get("/health", (request, reply) => {
    reply.send("OK");
  });

  server.get("/", (request, reply) => {
    reply.send("OK");
  });
};

async function startServer(
  port: number,
  server: FastifyInstance,
  logger: FastifyBaseLogger
) {
  try {
    await server.listen({ port });
    logger.info(`Server running on port ${port}`);
    if (server.cron) {
      server.cron.startAllJobs();
    }
  } catch (err) {
    logger.error("Errored while listening");
    logger.error(err);
    process.exit(1);
  }
}

export function setupServer(
  cronJob: CronJobVal,
  env: { NODE_ENV: keyof typeof envToLogger }
) {
  const server = Fastify({
    logger: envToLogger[env.NODE_ENV],
  });

  const logger = server.log;

  registerCronJobs([cronJob], server);
  routes(server);
  startServer(8080, server, logger);

  return { server, logger };
}