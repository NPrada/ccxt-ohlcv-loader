export const envToLogger = {
  development: {
    level: "debug",
    transport: {
      level: "debug",
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },

  production: {
    level: "debug",
    transport: {
      targets: [
        {
          level: "info",
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      ],
    },
  },
  test: {},
} as const;