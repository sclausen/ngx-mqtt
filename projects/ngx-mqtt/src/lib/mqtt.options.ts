import type { IClientOptions } from 'mqtt';
import type { MqttServiceOptions } from './mqtt.model';

export function resolveUrl(options: MqttServiceOptions): string {
  if (options.url) {
    return options.url;
  }
  const protocol = options.protocol ?? 'ws';
  const hostname = options.hostname ?? 'localhost';
  const port = options.port ? `:${options.port}` : '';
  return `${protocol}://${hostname}${port}${options.path ?? ''}`;
}

export function toClientOptions(options: MqttServiceOptions): IClientOptions {
  const {
    connectOnCreate: _connectOnCreate,
    logLevel: _logLevel,
    logger: _logger,
    url: _url,
    hostname: _hostname,
    port: _port,
    path: _path,
    protocol: _protocol,
    ...clientOptions
  } = options;
  return clientOptions;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function mergeRecords(
  ...sources: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const [key, value] of Object.entries(source)) {
      const existing = result[key];
      result[key] = isPlainObject(value)
        ? mergeRecords(isPlainObject(existing) ? existing : undefined, value)
        : value;
    }
  }
  return result;
}

export function mergeOptions(...sources: (MqttServiceOptions | undefined)[]): MqttServiceOptions {
  return mergeRecords(
    ...(sources as (Record<string, unknown> | undefined)[]),
  ) as MqttServiceOptions;
}

export function generateClientId(source: { randomUUID?: () => string } | undefined = {}): string {
  const id =
    source?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `ngx-mqtt-${id}`;
}
