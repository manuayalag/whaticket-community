import pino from "pino";

const logger = pino({
  enabled: true,
  level: "debug"
});

export { logger };
