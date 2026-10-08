import { TestBed } from '@angular/core/testing';
import mqtt, { type MqttClient } from 'mqtt';
import { filter, firstValueFrom, type Observable, take, timeout, toArray } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type IMqttMessage,
  MqttConnectionState,
  MqttService,
  type MqttServiceOptions,
  provideMqtt,
} from '../public-api';

const BROKER = 'ws://localhost:9001';
const prefix = `ngx-mqtt/it/${crypto.randomUUID()}`;

const within = <T>(source: Observable<T>) => firstValueFrom(source.pipe(timeout(5000)));
const text = (message: IMqttMessage) => new TextDecoder().decode(message.payload);

async function setup(client?: MqttClient, options: MqttServiceOptions = {}) {
  TestBed.configureTestingModule({
    providers: [provideMqtt({ url: BROKER, logLevel: 'silent', ...options }, client)],
  });
  const service = TestBed.inject(MqttService);
  await within(service.state.pipe(filter((s) => s === MqttConnectionState.CONNECTED)));
  return service;
}

function subscribed(service: MqttService, filterString: string) {
  return within(service.onSuback.pipe(filter((s) => s.filter === filterString && s.granted)));
}

afterEach(() => TestBed.resetTestingModule());

describe('MqttService against Mosquitto', () => {
  it('connects', async () => {
    const service = await setup();
    expect(service.connectionState()).toBe(MqttConnectionState.CONNECTED);
  });

  it('receives what it publishes', async () => {
    const service = await setup();
    const topic = `${prefix}/publish`;
    const ready = subscribed(service, topic);
    const received = within(service.observe(topic));
    await ready;
    await within(service.publish(topic, 'hello'));
    const message = await received;
    expect(text(message)).toBe('hello');
    expect(message.payload.toString()).toBe('hello');
  });

  it('routes wildcard subscriptions', async () => {
    const service = await setup();
    const wildcard = `${prefix}/wild/+/temp`;
    const ready = subscribed(service, wildcard);
    const received = within(service.observe(wildcard).pipe(take(2), toArray()));
    await ready;
    service.unsafePublish(`${prefix}/wild/kitchen/temp`, '21');
    service.unsafePublish(`${prefix}/wild/kitchen/humidity`, '40');
    service.unsafePublish(`${prefix}/wild/hall/temp`, '19');
    const messages = await received;
    expect(messages.map((m) => m.topic)).toEqual([
      `${prefix}/wild/kitchen/temp`,
      `${prefix}/wild/hall/temp`,
    ]);
  });

  it('delivers retained messages and replays them to late subscribers', async () => {
    const service = await setup();
    const topic = `${prefix}/retained`;
    await within(service.publish(topic, 'kept', { retain: true, qos: 1 }));
    const first = service.observeRetained(topic);
    const holder = first.subscribe();
    expect(text(await within(first))).toBe('kept');
    expect(text(await within(service.observeRetained(topic)))).toBe('kept');
    holder.unsubscribe();
    await within(service.publish(topic, '', { retain: true, qos: 1 }));
  });

  it('keeps a single delivery per message after a forced reconnect', async () => {
    const client = mqtt.connect(BROKER, {
      clientId: `ngx-mqtt-it-${crypto.randomUUID()}`,
      reconnectPeriod: 200,
    });
    const service = await setup(client);
    const topic = `${prefix}/reconnect`;
    const ready = subscribed(service, topic);
    const received: string[] = [];
    const subscription = service.observe(topic).subscribe((m) => received.push(text(m)));
    await ready;
    const reconnected = within(service.onConnect);
    client.stream.destroy();
    await reconnected;
    service.unsafePublish(topic, 'once', { qos: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    subscription.unsubscribe();
    expect(received).toEqual(['once']);
  });

  it('disconnects cleanly', async () => {
    const service = await setup();
    const closed = within(service.state.pipe(filter((s) => s === MqttConnectionState.CLOSED)));
    service.disconnect();
    await closed;
    expect(service.connectionState()).toBe(MqttConnectionState.CLOSED);
  });
});
