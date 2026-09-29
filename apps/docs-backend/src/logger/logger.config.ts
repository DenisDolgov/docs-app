import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options as PinoHttpOptions } from 'pino-http';
import pinoPretty from 'pino-pretty';

type ConfigReader = { get: (key: string) => unknown };

const genReqId = (
  req: { headers: Record<string, unknown> },
  res: { setHeader: (name: string, value: string) => void },
) => {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  const generated = randomUUID();
  res.setHeader('x-request-id', generated);
  return generated;
};

export function createLoggerParams(
  config: ConfigReader,
  destination?: DestinationStream,
): Params {
  const nodeEnv = config.get('NODE_ENV');
  const isProduction = nodeEnv === 'production';
  const options: PinoHttpOptions = {
    level: isProduction ? 'info' : 'debug',
    genReqId,
  };

  if (destination) {
    return { pinoHttp: [options, destination] };
  }

  if (nodeEnv === 'development') {
    options.stream = pinoPretty({ colorize: true, singleLine: true });
  }

  return { pinoHttp: options };
}
