import { TestBed } from '@angular/core/testing';
import { Subscription, firstValueFrom, noop, of } from 'rxjs';
import { concatMap, first, map, skip, tap } from 'rxjs/operators';
import mqtt from 'mqtt';
import { ISubackPacket } from 'mqtt-packet';

import { IMqttServiceOptions, MqttConnectionState } from './mqtt.model';
import { MqttService } from './mqtt.service';
import { MqttClientService, MqttServiceConfig } from './mqtt.module';

const config: IMqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'localhost',
  port: 9001,
};

const currentUuid = generateUuid();
let originalTimeout: number;
let mqttService: MqttService;

beforeEach(() => {
  originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

  TestBed.resetTestingModule().configureTestingModule({
    providers: [
      {
        provide: MqttServiceConfig,
        useValue: config,
      },
      {
        provide: MqttClientService,
        useValue: undefined,
      },
    ],
  });
  mqttService = TestBed.inject(MqttService);
});

afterEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
});

describe('MqttService', () => {
  it('#constructor', () => {
    expect(mqttService).toBeDefined();
  });

  it('#observe', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe({
      next: (message: mqtt.IPublishPacket) => {
        expect(message.payload).toBeDefined();
        done();
      },
      error: (err) => done.fail(err),
    });
  });

  it('#publish', (done) => {
    const topic = `ngx-mqtt/tests/publish/${currentUuid}`;
    const messageToSend = 'publish';

    const subscription = mqttService
      .observe(topic)
      .pipe(map((v: mqtt.IPublishPacket) => v.payload.toString()))
      .subscribe({
        next: (message) => {
          expect(message).toBe(messageToSend);
          subscription.unsubscribe();
          done();
        },
        error: (err: any) => done.fail(err),
      });

    setTimeout(() => {
      mqttService.publish(topic, messageToSend);
    }, 1000);
  });

  it('#unsafePublish', (done) => {
    mqttService
      .observe('ngx-mqtt/tests/unsafePublish/' + currentUuid)
      .subscribe({
        next: (message: mqtt.IPublishPacket) => {
          expect(message.payload.toString()).toBe('unsafePublish');
          done();
        },
        error: (err) => done.fail(err),
      });
    mqttService.unsafePublish(
      'ngx-mqtt/tests/unsafePublish/' + currentUuid,
      'unsafePublish'
    );
  });

  it('#onMessage', (done) => {
    const topic = '$SYS/broker/uptime';

    // Step 1: Subscribe to the topic to start observing messages.
    const subscription = mqttService.observe(topic).subscribe({
      next: noop, // You're not directly asserting in the subscription, so noop is fine here.
      error: (err) => done.fail(err), // Ensure to handle errors gracefully.
    });

    // Step 2: After ensuring the subscription is active, listen for the first message.
    firstValueFrom(mqttService.onMessage)
      .then((e: mqtt.IPublishPacket) => {
        expect(e.cmd).toBe('publish');
        subscription.unsubscribe(); // Cleanup after the test is done.
        done();
      })
      .catch((err) => {
        // Handle possible errors from firstValueFrom
        done.fail(err);
      });
  });

  it('#onSuback', (done) => {
    const subackSubscription = mqttService.onSuback.subscribe({
      next: (e: ISubackPacket) => {
        expect(
          e.granted.some((grant: any) => grant.topic === '$SYS/broker/uptime')
        ).toBeTrue();
        expect(e.granted.length).toBeTruthy();
        subackSubscription.unsubscribe();
        done();
      },
      error: (err: any) => {
        console.error(err);
        done.fail(err);
      },
    });

    mqttService.observe('$SYS/broker/uptime').subscribe({
      next: noop,
      error: (err: any) => done.fail(err),
    });
  });
});

describe('MqttService Retained Behavior', () => {
  it('emit the retained message for all current and new subscribers', (done) => {
    let counter = 0;
    const topic = 'ngx-mqtt/tests/retained/' + currentUuid;
    const mqttSubscriptions: IMqttSubscription[] = [];
    function observe(): void {
      const s: IMqttSubscription = {
        id: counter++,
        payload: null,
      };
      s.subscription = mqttService
        .observeRetained(topic)
        .pipe(map((v: mqtt.IPublishPacket) => v.payload.toString()))
        .subscribe({
          next: (message) => {
            s.payload = message;
          },
          error: (err: any) => done.fail(err),
        });
      mqttSubscriptions.push(s);
    }
    mqttService.unsafePublish(topic, 'foobar', { retain: true, qos: 0 });
    interface IMqttSubscription {
      subscription?: Subscription;
      id: number;
      payload: any;
    }
    observe();
    setTimeout(() => observe(), 100);
    setTimeout(() => observe(), 200);
    setTimeout(() => {
      expect(
        mqttSubscriptions.every((s: IMqttSubscription) => !!s.payload)
      ).toBeTrue();
      done();
    }, 3000);
  });

  it('do not emit not retained message on late subscribe', (done) => {
    const topic = 'ngx-mqtt/tests/notRetained/' + currentUuid;
    let lateMessage: mqtt.IPublishPacket; // this message should never occur
    mqttService.observe(topic).subscribe({
      next: (msg1: mqtt.IPublishPacket) => {
        expect(msg1).toBeDefined();
        mqttService.observe(topic).subscribe({
          next: (msg2: mqtt.IPublishPacket) => (lateMessage = msg2),
          error: (err) => done.fail(err),
        });
        setTimeout(() => {
          expect(lateMessage).toBeUndefined();
          done();
        }, 1000);
      },
      error: (err) => done.fail(err),
    });
    setTimeout(() => {
      mqttService.unsafePublish(topic, 'foobar');
    }, 1000);
  });
});

describe('MqttService.filterMatchesTopic', () => {
  it('is defined', () => {
    expect(MqttService.filterMatchesTopic).toBeDefined();
  });
  const matches: any = [
    ['$', '#', false],
    ['a', 'a', true],
    ['a', '#', true],
    ['a', 'a/#', true],
    ['a/b', 'a/#', true],
    ['a/b/c', 'a/#', true],
    ['b/c/d', 'a/#', false],
    ['a', 'a/+', false],
    ['a', '/a', false],
    ['a/b', 'a/b', true],
    ['a/b/c', 'a/+/c', true],
    ['a/b/c', 'a/+/d', false],
    ['#', '$SYS/#', false],
    ['a/b', 'a/+', true],
    ['a/b', 'a/#', true],
    ['a/b', 'a/b/#', true],
    ['a/b/c', 'a/b/c', true],
  ];
  for (let i = 0; i < matches.length; i++) {
    it(`${matches[i][0]} matches ${matches[i][1]}: ${matches[i][2]}`, () => {
      expect(MqttService.filterMatchesTopic(matches[i][1], matches[i][0])).toBe(
        matches[i][2]
      );
    });
  }
});

function generateUuid() {
  let uuid = '',
    i,
    random;
  for (i = 0; i < 32; i++) {
    random = (Math.random() * 16) | 0;

    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(16);
  }
  return uuid;
}
