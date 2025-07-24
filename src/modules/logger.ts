import pino from 'pino';

process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --no-warnings';

const transportConfig: pino.TransportSingleOptions | undefined =
  process.env.NODE_ENV !== 'production'
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        encoding: 'utf8'
      }
    }
    : undefined;

export const logger = pino({
  name: 'cex-spider',
  level: process.env.LOG_LEVEL || 'info',
  transport: transportConfig,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  }
});

export type Logger = pino.Logger;