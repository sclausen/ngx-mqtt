import { TestBed } from '@angular/core/testing';
import { bufferCount, firstValueFrom, type Observable, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MqttConnectionState, type MqttServiceOptions } from './mqtt.model';
import { MqttService } from './mqtt.service';
import { MqttClientService, MqttServiceConfig } from './mqtt.tokens';
import { FakeMqttClient, flush } from './testing/fake-mqtt-client';

function setup(options: MqttServiceOptions = {}, fake = new FakeMqttClient()) {
  TestBed.configureTestingModule({
    providers: [
      { provide: MqttServiceConfig, useValue: { logLevel: 'silent', ...options } },
      { provide: MqttClientService, useValue: fake.asClient() },
    ],
  });
  return { service: TestBed.inject(MqttService), fake };
}

const current = <T>(service: MqttService, pick: (s: MqttService) => Observable<T>) =>
  firstValueFrom(pick(service));

describe('MqttService connection', () => {
  it('connects on creation with the injected client', async () => {
    const { service, fake } = setup();
    expect(await current(service, (s) => s.state)).toBe(MqttConnectionState.CONNECTING);
    fake.emit('connect', { cmd: 'connack' });
    expect(await current(service, (s) => s.state)).toBe(MqttConnectionState.CONNECTED);
    expect(service.connectionState()).toBe(MqttConnectionState.CONNECTED);
  });

  it('does not connect when connectOnCreate is false', async () => {
    const { service } = setup({ connectOnCreate: false });
    expect(await current(service, (s) => s.state)).toBe(MqttConnectionState.CLOSED);
    expect(() => service.publish('t', 'm')).toThrowError('mqtt client not connected');
    expect(() => service.disconnect()).toThrowError('mqtt client not connected');
  });

  it('tracks reconnect and close', async () => {
    const { service, fake } = setup();
    const reconnects = firstValueFrom(service.onReconnect);
    fake.emit('connect', { cmd: 'connack' });
    fake.emit('reconnect');
    await reconnects;
    expect(service.connectionState()).toBe(MqttConnectionState.CONNECTING);
    const closes = firstValueFrom(service.onClose);
    fake.emit('close');
    await closes;
    expect(service.connectionState()).toBe(MqttConnectionState.CLOSED);
  });

  it('forwards lifecycle events', async () => {
    const { service, fake } = setup();
    const connack = firstValueFrom(service.onConnect);
    const offline = firstValueFrom(service.onOffline);
    const end = firstValueFrom(service.onEnd);
    const errors = firstValueFrom(service.onError.pipe(bufferCount(2)));
    const sent = firstValueFrom(service.onPacketsend);
    const received = firstValueFrom(service.onPacketreceive);
    fake.emit('connect', { cmd: 'connack', returnCode: 0 });
    fake.emit('offline');
    fake.emit('end');
    fake.emit('error', new Error('client'));
    fake.stream.emit('error', new Error('stream'));
    fake.emit('packetsend', { cmd: 'pingreq' });
    fake.emit('packetreceive', { cmd: 'pingresp' });
    expect(await connack).toEqual({ cmd: 'connack', returnCode: 0 });
    await offline;
    await end;
    expect((await errors).map((e) => e.message)).toEqual(['client', 'stream']);
    expect((await sent).cmd).toBe('pingreq');
    expect((await received).cmd).toBe('pingresp');
  });

  it('emits incoming publish packets on messages and onMessage', async () => {
    const { service, fake } = setup();
    const message = firstValueFrom(service.messages);
    const packet = firstValueFrom(service.onMessage);
    fake.deliver('a/b', 'hello');
    expect(new TextDecoder().decode((await message).payload)).toBe('hello');
    expect((await packet).cmd).toBe('publish');
  });

  it('ignores events from a replaced client and ends it', async () => {
    const { service, fake } = setup();
    const replacement = new FakeMqttClient();
    service.connect({}, replacement.asClient());
    expect(fake.endCalls).toEqual([true]);
    fake.emit('close');
    expect(service.connectionState()).toBe(MqttConnectionState.CONNECTING);
    replacement.emit('connect', { cmd: 'connack' });
    expect(service.connectionState()).toBe(MqttConnectionState.CONNECTED);
  });

  it('keeps state, clientId and the previous client when creating a client throws', async () => {
    const { service, fake } = setup({ clientId: 'kept' });
    fake.emit('connect', { cmd: 'connack' });
    expect(() => service.connect({ url: 'localhost', clientId: 'other' })).toThrowError(
      'Missing protocol',
    );
    expect(await current(service, (s) => s.state)).toBe(MqttConnectionState.CONNECTED);
    expect(service.clientId).toBe('kept');
    expect(fake.endCalls).toEqual([]);
    fake.emit('close');
    expect(service.connectionState()).toBe(MqttConnectionState.CLOSED);
  });

  it('disconnects with force true by default', () => {
    const { service, fake } = setup();
    service.disconnect();
    service.disconnect(false);
    expect(fake.endCalls).toEqual([true, false]);
  });

  it('uses a configured clientId and generates one otherwise', () => {
    expect(setup({ clientId: 'fixed-id' }).service.clientId).toBe('fixed-id');
    TestBed.resetTestingModule();
    expect(setup().service.clientId).toMatch(/^ngx-mqtt-/);
  });

  it('does not mutate the injected options', () => {
    const options: MqttServiceOptions = {
      hostname: 'a',
      will: { topic: 't', payload: 'p', qos: 0, retain: false },
    };
    const snapshot = structuredClone(options);
    TestBed.configureTestingModule({
      providers: [
        { provide: MqttServiceConfig, useValue: options },
        { provide: MqttClientService, useValue: new FakeMqttClient().asClient() },
      ],
    });
    const service = TestBed.inject(MqttService);
    service.connect(
      { hostname: 'b', will: { topic: 'u', payload: 'q', qos: 1, retain: true } },
      new FakeMqttClient().asClient(),
    );
    expect(options).toEqual(snapshot);
  });

  it('ends the client when the injector is destroyed', () => {
    const { fake } = setup();
    TestBed.resetTestingModule();
    expect(fake.endCalls).toEqual([true]);
  });

  it('exposes the topic matcher statically', () => {
    expect(MqttService.filterMatchesTopic('a/+', 'a/b')).toBe(true);
  });
});

describe('MqttService publish', () => {
  it('publishes only when subscribed and completes on success', async () => {
    const { service, fake } = setup();
    const result = service.publish('t', 'm', { qos: 1 });
    expect(fake.publishCalls).toEqual([]);
    const values = await firstValueFrom(result.pipe(toArray()));
    expect(values).toEqual([undefined]);
    expect(fake.publishCalls).toEqual([{ topic: 't', message: 'm', opts: { qos: 1 } }]);
  });

  it('errors when the client reports a failure', async () => {
    const { service, fake } = setup();
    fake.publishError = new Error('nope');
    await expect(firstValueFrom(service.publish('t', 'm'))).rejects.toThrowError('nope');
  });

  it('publishes immediately with unsafePublish', async () => {
    const { service, fake } = setup();
    service.unsafePublish('t', 'm');
    expect(fake.publishCalls).toEqual([{ topic: 't', message: 'm', opts: {} }]);
    await flush();
  });
});
