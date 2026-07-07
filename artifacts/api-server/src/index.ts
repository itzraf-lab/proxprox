import app from "./app";
import { logger } from "./lib/logger";
import { syncModelsToLiteLLM } from "./lib/sync.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Kick off model sync in the background — don't block startup.
  // syncModelsToLiteLLM waits for LiteLLM to be ready internally.
  syncModelsToLiteLLM().catch((err) =>
    logger.error({ err }, "Model sync failed unexpectedly"),
  );
});
