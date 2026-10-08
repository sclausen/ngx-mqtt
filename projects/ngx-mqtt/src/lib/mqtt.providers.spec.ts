import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import * as api from '../public-api';
import { MqttModule, provideMqtt } from './mqtt.providers';
import { MqttService } from './mqtt.service';
import { FakeMqttClient } from './testing/fake-mqtt-client';

describe('provideMqtt', () => {
  it('configures MqttService with options and client', () => {
    const fake = new FakeMqttClient();
    TestBed.configureTestingModule({
      providers: [provideMqtt({ clientId: 'via-provider', logLevel: 'silent' }, fake.asClient())],
    });
    const service = TestBed.inject(MqttService);
    service.observe('a').subscribe();
    expect(service.clientId).toBe('via-provider');
    expect(fake.subscribeCalls.map((c) => c.filter)).toEqual(['a']);
  });

  it('is equivalent to the deprecated MqttModule.forRoot', () => {
    const fake = new FakeMqttClient();
    TestBed.configureTestingModule({
      imports: [
        MqttModule.forRoot({ clientId: 'via-module', logLevel: 'silent' }, fake.asClient()),
      ],
    });
    const service = TestBed.inject(MqttService);
    service.observe('b').subscribe();
    expect(service.clientId).toBe('via-module');
    expect(fake.subscribeCalls.map((c) => c.filter)).toEqual(['b']);
  });

  it('throws a helpful error without configuration', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.inject(MqttService)).toThrowError(/provideMqtt/);
  });
});

describe('public API', () => {
  it('exports the documented surface', () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        'MqttClientService',
        'MqttConnectionState',
        'MqttModule',
        'MqttService',
        'MqttServiceConfig',
        'filterMatchesTopic',
        'provideMqtt',
      ].sort(),
    );
  });
});
