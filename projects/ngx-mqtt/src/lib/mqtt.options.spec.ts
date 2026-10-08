import { describe, expect, it } from 'vitest';
import type { MqttServiceOptions } from './mqtt.model';
import { generateClientId, mergeOptions, resolveUrl, toClientOptions } from './mqtt.options';

describe('resolveUrl', () => {
  it('defaults to ws://localhost', () => {
    expect(resolveUrl({})).toBe('ws://localhost');
  });

  it('builds the url from protocol, hostname, port and path', () => {
    expect(resolveUrl({ protocol: 'wss', hostname: 'broker', port: 8884, path: '/mqtt' })).toBe(
      'wss://broker:8884/mqtt',
    );
  });

  it('prefers url over the separate fields', () => {
    expect(resolveUrl({ url: 'wss://a.example/mqtt', hostname: 'b', port: 1 })).toBe(
      'wss://a.example/mqtt',
    );
  });
});

describe('toClientOptions', () => {
  it('strips ngx-mqtt specific fields', () => {
    const logger = () => undefined;
    const result = toClientOptions({
      connectOnCreate: false,
      logLevel: 'debug',
      logger,
      clientId: 'abc',
      username: 'user',
    });
    expect(result).toEqual({ clientId: 'abc', username: 'user' });
  });

  it('strips broker address fields', () => {
    const result = toClientOptions({
      url: 'wss://a.example/mqtt',
      hostname: 'b',
      port: 1,
      path: '/x',
      protocol: 'ws',
      keepalive: 30,
    });
    expect(result).toEqual({ keepalive: 30 });
  });
});

describe('mergeOptions', () => {
  it('lets later sources win', () => {
    expect(mergeOptions({ port: 1, hostname: 'a' }, { port: 2 })).toEqual({
      port: 2,
      hostname: 'a',
    });
  });

  it('deep merges plain objects', () => {
    const merged = mergeOptions(
      { will: { topic: 't', payload: 'p', qos: 0, retain: false } },
      { will: { topic: 'u', payload: 'p', qos: 1, retain: false } },
    );
    expect(merged.will).toEqual({ topic: 'u', payload: 'p', qos: 1, retain: false });
  });

  it('does not mutate any source', () => {
    const base: MqttServiceOptions = {
      hostname: 'a',
      will: { topic: 't', payload: 'p', qos: 0, retain: false },
    };
    const snapshot = structuredClone(base);
    mergeOptions(base, { hostname: 'b', will: { topic: 'u', payload: 'q', qos: 1, retain: true } });
    expect(base).toEqual(snapshot);
  });

  it('copies functions by reference and skips undefined sources', () => {
    const logger = () => undefined;
    expect(mergeOptions(undefined, { logger }, undefined).logger).toBe(logger);
  });
});

describe('generateClientId', () => {
  it('uses randomUUID with an ngx-mqtt prefix', () => {
    expect(generateClientId({ randomUUID: () => 'fixed' })).toBe('ngx-mqtt-fixed');
  });

  it('falls back when randomUUID is unavailable', () => {
    const first = generateClientId({});
    const second = generateClientId({ randomUUID: undefined });
    expect(first).toMatch(/^ngx-mqtt-[a-z0-9]{8,}$/);
    expect(second).toMatch(/^ngx-mqtt-[a-z0-9]{8,}$/);
    expect(first).not.toBe(second);
  });

  it('uses crypto.randomUUID by default', () => {
    const id = generateClientId();
    expect(id).toMatch(/^ngx-mqtt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
