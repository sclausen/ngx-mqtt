import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { IMqttMessage, IOnSubackEvent, MqttServiceOptions } from './mqtt.model';
import { MqttService } from './mqtt.service';
import { MqttClientService, MqttServiceConfig } from './mqtt.tokens';
import { FakeMqttClient, flush } from './testing/fake-mqtt-client';

function setup(options: MqttServiceOptions = {}) {
  const fake = new FakeMqttClient();
  TestBed.configureTestingModule({
    providers: [
      { provide: MqttServiceConfig, useValue: { logLevel: 'silent', ...options } },
      { provide: MqttClientService, useValue: fake.asClient() },
    ],
  });
  return { service: TestBed.inject(MqttService), fake };
}

const text = (message: IMqttMessage) => new TextDecoder().decode(message.payload);

describe('MqttService.observe', () => {
  it('subscribes at the broker once per filter', () => {
    const { service, fake } = setup();
    const first = service.observe('a/#').subscribe();
    const second = service.observe('a/#').subscribe();
    expect(fake.subscribeCalls).toEqual([{ filter: 'a/#', opts: { qos: 1 } }]);
    expect(Object.keys(service.observables)).toEqual(['a/#']);
    first.unsubscribe();
    second.unsubscribe();
  });

  it('passes custom subscribe options', () => {
    const { service, fake } = setup();
    service.observe('a', { qos: 2 }).subscribe();
    expect(fake.subscribeCalls[0].opts).toEqual({ qos: 2 });
  });

  it('unsubscribes at the broker after the last subscriber leaves', () => {
    const { service, fake } = setup();
    const first = service.observe('a').subscribe();
    const second = service.observe('a').subscribe();
    first.unsubscribe();
    expect(fake.unsubscribeCalls).toEqual([]);
    second.unsubscribe();
    expect(fake.unsubscribeCalls).toEqual(['a']);
    expect(service.observables).toEqual({});
  });

  it('routes messages by filter', () => {
    const { service, fake } = setup();
    const received: string[] = [];
    service.observe('a/+').subscribe((m) => received.push(m.topic));
    fake.deliver('a/b', 'x');
    fake.deliver('b/c', 'y');
    fake.deliver('a/b/c', 'z');
    expect(received).toEqual(['a/b']);
  });

  it('does not replay to late subscribers', () => {
    const { service, fake } = setup();
    service.observe('a').subscribe();
    fake.deliver('a', 'early');
    const late: string[] = [];
    service.observe('a').subscribe((m) => late.push(text(m)));
    expect(late).toEqual([]);
  });

  it('replays the last message to late subscribers with observeRetained', () => {
    const { service, fake } = setup();
    service.observeRetained('a').subscribe();
    fake.deliver('a', 'first');
    fake.deliver('a', 'second');
    const late: string[] = [];
    service.observeRetained('a').subscribe((m) => late.push(text(m)));
    expect(late).toEqual(['second']);
  });

  it('reports granted subscriptions on onSuback', async () => {
    const { service } = setup();
    const suback = firstValueFrom(service.onSuback);
    service.observe('a').subscribe();
    expect(await suback).toEqual<IOnSubackEvent>({ filter: 'a', granted: true });
  });

  it('errors the observable when the broker rejects the subscription', async () => {
    const { service, fake } = setup();
    fake.grantedQos = 128;
    const suback = firstValueFrom(service.onSuback);
    const result = firstValueFrom(service.observe('forbidden'));
    await expect(result).rejects.toThrowError("subscription for 'forbidden' rejected!");
    expect(await suback).toEqual<IOnSubackEvent>({ filter: 'forbidden', granted: false });
    expect(fake.unsubscribeCalls).toEqual(['forbidden']);
    expect(service.observables).toEqual({});
  });

  it('throws when not connected', () => {
    const { service } = setup({ connectOnCreate: false });
    expect(() => service.observe('a')).toThrowError('mqtt client not connected');
  });

  it('does not resubscribe itself on connect or reconnect', async () => {
    const { service, fake } = setup();
    service.observe('a').subscribe();
    fake.emit('connect', { cmd: 'connack' });
    fake.emit('reconnect');
    fake.emit('connect', { cmd: 'connack' });
    await flush();
    expect(fake.subscribeCalls.length).toBe(1);
  });

  it('resubscribes active filters on a replacement client', () => {
    const { service } = setup();
    const received: string[] = [];
    service.observe('a/#', { qos: 2 }).subscribe((m) => received.push(text(m)));
    const replacement = new FakeMqttClient();
    service.connect({}, replacement.asClient());
    expect(replacement.subscribeCalls).toEqual([{ filter: 'a/#', opts: { qos: 2 } }]);
    replacement.deliver('a/b', 'after');
    expect(received).toEqual(['after']);
  });

  it('unsubscribes from the current client after replacement', () => {
    const { service } = setup();
    const subscription = service.observe('a').subscribe();
    const replacement = new FakeMqttClient();
    service.connect({}, replacement.asClient());
    subscription.unsubscribe();
    expect(replacement.unsubscribeCalls).toEqual(['a']);
  });
});
