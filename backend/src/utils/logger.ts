import pino from "pino";

const logger = pino({
  enabled: true,
  level: "debug",
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: "SYS:standard",
    }
  },
  timestamps: true,
  base: undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

export { logger };
