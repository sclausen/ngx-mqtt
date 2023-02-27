import { TestBed } from '@angular/core/testing';

import { skip, map, mergeMap, scan } from 'rxjs/operators';
import { noop, Subscription, of } from 'rxjs';

import { MqttService } from './mqtt.service';
import { MqttServiceConfig, MqttClientService } from './mqtt.module';
import {
  IMqttMessage,
  IMqttServiceOptions,
  IOnConnectEvent,
  IOnErrorEvent,
  IOnMessageEvent,
  IOnSubackEvent,
  MqttConnectionState
} from './mqtt.model';

const config: IMqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'localhost',
  port: 9001
};

const currentUuid = generateUuid();
let originalTimeout: number;
let mqttService: MqttService;

beforeEach(() => {
  originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

  TestBed.configureTestingModule({
    providers: [
      {
        provide: MqttServiceConfig,
        useValue: config
      },
      {
        provide: MqttClientService,
        useValue: undefined
      }
    ]
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


  it('#connect', (done) => {
    mqttService.disconnect(true);
    mqttService.connect({ ...config, clientId: 'connect' + currentUuid });
    mqttService.state.pipe(skip(2)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CONNECTED);
      expect(mqttService.clientId).toBe('connect' + currentUuid);
      done();
    });
  });

  it('#clientId', () => {
    expect(mqttService.clientId.startsWith('client-')).toBeTruthy();
  });

  it('#disconnect', (done) => {
    mqttService.disconnect(true);
    mqttService.state.pipe(skip(1)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CLOSED);
      done();
    });
  });

  it('#observe', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe((message: IMqttMessage) => {
      expect(message.payload).toBeDefined();
      done();
    });
  });

  it('#publish', (done) => {
    mqttService.observe('ngx-mqtt/tests/publish/' + currentUuid).subscribe((message: IMqttMessage) => {
      expect(message.payload.toString()).toBe('publish');
      done();
    });
    mqttService.publish('ngx-mqtt/tests/publish/' + currentUuid, 'publish').subscribe(noop);
  });

  it('#unsafePublish', (done) => {
    mqttService.observe('ngx-mqtt/tests/unsafePublish/' + currentUuid).subscribe((message: IMqttMessage) => {
      expect(message.payload.toString()).toBe('unsafePublish');
      done();
    });
    mqttService.unsafePublish('ngx-mqtt/tests/unsafePublish/' + currentUuid, 'unsafePublish');
  });


  it('#onClose', (done) => {
    mqttService.disconnect(true);
    mqttService.onClose.subscribe(() => {
      done();
    });
  });

  it('#onConnect', (done) => {
    mqttService.onConnect.subscribe((e: IOnConnectEvent) => {
      expect(e.cmd).toBe('connack');
      done();
    });
  });

  // it('#onReconnect', (done) => {

  // });

  it('#onMessage', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe(noop);
    mqttService.onMessage.subscribe((e: IOnMessageEvent) => {
      expect(e.cmd).toBe('publish');
      done();
    });
  });

  it('#onSuback', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe(noop);
    mqttService.onSuback.subscribe((e: IOnSubackEvent) => {
      expect(e.filter).toBe('$SYS/broker/uptime');
      expect(e.granted).toBeTruthy();
      done();
    });
  });

  it('#onError', (done) => {
    mqttService.disconnect(true);
    mqttService.connect({ hostname: 'not_existing' });
    mqttService.state.pipe(skip(2)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CLOSED);
      mqttService.unsafePublish('onError', 'shouldThrow');
    });
    mqttService.onError.subscribe((e: IOnErrorEvent) => {
      expect(e.type).toBe('error');
      done();
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
        payload: null
      };
      s.subscription = mqttService
        .observeRetained(topic)
        .pipe(map((v: IMqttMessage) => v.payload))
        .subscribe(msg => {
          s.payload = msg;
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
      mqttSubscriptions.map((s: IMqttSubscription) => {
        expect(s.payload).toBeTruthy();
      });
      done();
    }, 3000);
  });

  it('do not emit not retained message on late subscribe', (done) => {
    const topic = 'ngx-mqtt/tests/notRetained/' + currentUuid;
    let lateMessage: IMqttMessage; // this message should never occur
    mqttService.observe(topic).subscribe((msg1: IMqttMessage) => {
      expect(msg1).toBeDefined();
      mqttService.observe(topic).subscribe((msg2: IMqttMessage) => lateMessage = msg2);
      setTimeout(() => {
        expect(lateMessage).toBeUndefined();
        done();
      }, 1000);
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
      expect(MqttService.filterMatchesTopic(matches[i][1], matches[i][0])).toBe(matches[i][2]);
    });
  }
});

function generateUuid() {
  let uuid = '', i, random;
  for (i = 0; i < 32; i++) {
    random = Math.random() * 16 | 0;

    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
  }
  return uuid;
}
