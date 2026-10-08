import { TestBed } from '@angular/core/testing';
import type { Packet } from 'mqtt';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MqttInternalEvent } from './mqtt.internal';
import { redact, startLogging } from './mqtt.logger';
import type { IOnErrorEvent, IOnSubackEvent, MqttLogEntry, MqttServiceOptions } from './mqtt.model';
import { provideMqtt } from './mqtt.providers';
import { MqttService } from './mqtt.service';
import { FakeMqttClient, flush } from './testing/fake-mqtt-client';

function createSource() {
  return {
    onConnect: new Subject<unknown>(),
    onReconnect: new Subject<void>(),
    onClose: new Subject<void>(),
    onOffline: new Subject<void>(),
    onError: new Subject<IOnErrorEvent>(),
    onEnd: new Subject<void>(),
    onSuback: new Subject<IOnSubackEvent>(),
    onPacketsend: new Subject<Packet>(),
    onPacketreceive: new Subject<Packet>(),
  };
}

function start(options: Pick<MqttServiceOptions, 'logLevel'> = {}) {
  const source = createSource();
  const internal = new Subject<MqttInternalEvent>();
  const entries: MqttLogEntry[] = [];
  const subscription = startLogging(
    source,
    internal,
    { ...options, logger: (entry) => entries.push(entry) },
    () => 'client-1',
  );
  return { source, internal, entries, subscription };
}

afterEach(() => vi.restoreAllMocks());

describe('startLogging', () => {
  it('logs only errors by default', () => {
    const { source, entries } = start();
    source.onConnect.next({});
    source.onOffline.next();
    source.onError.next(new Error('boom'));
    expect(entries.map((e) => [e.level, e.event])).toEqual([['error', 'error']]);
  });

  it('maps every event to its level', () => {
    const { source, internal, entries } = start({ logLevel: 'debug' });
    source.onError.next(new Error('boom'));
    source.onOffline.next();
    source.onSuback.next({ filter: 'f', granted: false });
    source.onSuback.next({ filter: 'g', granted: true });
    internal.next({ type: 'publishError', topic: 't', error: new Error('nope') });
    source.onConnect.next({});
    source.onReconnect.next();
    source.onClose.next();
    source.onEnd.next();
    internal.next({ type: 'subscribe', filter: 'f' });
    internal.next({ type: 'unsubscribe', filter: 'f' });
    source.onPacketsend.next({ cmd: 'pingreq' });
    source.onPacketreceive.next({ cmd: 'pingresp' });
    expect(entries.map((e) => [e.level, e.event])).toEqual([
      ['error', 'error'],
      ['warn', 'offline'],
      ['warn', 'subscriptionRejected'],
      ['warn', 'publishFailed'],
      ['info', 'connect'],
      ['info', 'reconnect'],
      ['info', 'close'],
      ['info', 'end'],
      ['debug', 'subscribe'],
      ['debug', 'unsubscribe'],
      ['debug', 'packetsend'],
      ['debug', 'packetreceive'],
    ]);
  });

  it('filters below the configured level', () => {
    const { source, entries } = start({ logLevel: 'warn' });
    source.onConnect.next({});
    source.onOffline.next();
    expect(entries.map((e) => e.event)).toEqual(['offline']);
  });

  it('creates no subscriptions when silent', () => {
    const { source, internal } = start({ logLevel: 'silent' });
    expect(Object.values(source).some((subject) => subject.observed)).toBe(false);
    expect(internal.observed).toBe(false);
  });

  it('stops listening when unsubscribed', () => {
    const { source, subscription } = start({ logLevel: 'debug' });
    subscription.unsubscribe();
    expect(Object.values(source).some((subject) => subject.observed)).toBe(false);
  });

  it('produces structured entries', () => {
    const { source, entries } = start({ logLevel: 'warn' });
    source.onSuback.next({ filter: 'secret/area', granted: false });
    expect(entries[0]).toEqual({
      level: 'warn',
      event: 'subscriptionRejected',
      message: "subscription for 'secret/area' rejected",
      clientId: 'client-1',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      context: { filter: 'secret/area' },
    });
  });

  it('never logs payloads or credentials from packets', () => {
    const { source, entries } = start({ logLevel: 'debug' });
    source.onPacketsend.next({
      cmd: 'connect',
      clientId: 'x',
      username: 'top-secret-user',
      password: 'top-secret-password',
    } as unknown as Packet);
    source.onPacketreceive.next({
      cmd: 'publish',
      topic: 'a/b',
      payload: 'top-secret-payload',
      qos: 0,
      retain: false,
      dup: false,
    } as Packet);
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain('top-secret');
    expect(entries.map((e) => e.context)).toEqual([
      { cmd: 'connect' },
      { cmd: 'publish', topic: 'a/b' },
    ]);
  });

  it('redacts URL userinfo in error messages', () => {
    const { source, entries } = start();
    source.onError.next(new Error('connection to wss://alice:s3cret@broker.example/mqtt failed'));
    expect(entries[0].message).toBe('connection to wss://broker.example/mqtt failed');
  });

  it('redacts URL userinfo in publish failures', () => {
    const { internal, entries } = start({ logLevel: 'warn' });
    internal.next({
      type: 'publishError',
      topic: 't',
      error: new Error('socket wss://u:p@ss@host/mqtt closed'),
    });
    expect(entries[0].message).toBe("publish to 't' failed: socket wss://host/mqtt closed");
  });

  it('adds the reason code of MQTT errors', () => {
    const { source, entries } = start();
    source.onError.next(Object.assign(new Error('Not authorized'), { code: 135 }));
    expect(entries[0].context).toEqual({ reasonCode: 135 });
  });
});

describe('redact', () => {
  it('leaves URLs without userinfo untouched', () => {
    expect(redact('ws://localhost:9001')).toBe('ws://localhost:9001');
    expect(redact('see wss://broker.example/a@b for details')).toBe(
      'see wss://broker.example/a@b for details',
    );
  });

  it('fully redacts a password containing @', () => {
    expect(redact('wss://u:p@ss@host/mqtt')).toBe('wss://host/mqtt');
  });

  it('redacts every URL in a message', () => {
    expect(redact('ws://a:b@one:9001 and wss://c:d@e@two/mqtt')).toBe(
      'ws://one:9001 and wss://two/mqtt',
    );
  });
});

describe('logging through MqttService', () => {
  it('writes errors to console.error by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = new FakeMqttClient();
    TestBed.configureTestingModule({ providers: [provideMqtt({}, fake.asClient())] });
    TestBed.inject(MqttService);
    fake.emit('error', new Error('boom'));
    expect(spy).toHaveBeenCalledWith(
      '[ngx-mqtt]',
      'boom',
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('stays quiet when silent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = new FakeMqttClient();
    TestBed.configureTestingModule({
      providers: [provideMqtt({ logLevel: 'silent' }, fake.asClient())],
    });
    TestBed.inject(MqttService);
    fake.emit('error', new Error('boom'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports subscription changes and publish failures to a custom logger', async () => {
    const entries: MqttLogEntry[] = [];
    const fake = new FakeMqttClient();
    fake.publishError = new Error('denied');
    TestBed.configureTestingModule({
      providers: [
        provideMqtt({ logLevel: 'debug', logger: (e) => entries.push(e) }, fake.asClient()),
      ],
    });
    const service = TestBed.inject(MqttService);
    service.observe('a').subscribe().unsubscribe();
    service.publish('t', 'm').subscribe({ error: () => undefined });
    await flush();
    expect(entries.map((e) => e.event)).toEqual(['subscribe', 'unsubscribe', 'publishFailed']);
  });
});
