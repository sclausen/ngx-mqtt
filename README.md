# ngx-mqtt

Reactive MQTT for Angular. Topic subscriptions as Observables and Signals, shared and ref-counted, on top of MQTT.js v5.

[![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt)
[![CI](https://github.com/sclausen/ngx-mqtt/actions/workflows/ci.yml/badge.svg)](https://github.com/sclausen/ngx-mqtt/actions/workflows/ci.yml)
[![downloads](https://img.shields.io/npm/dm/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt)
[![license](https://img.shields.io/npm/l/ngx-mqtt.svg)](LICENSE)

## Why ngx-mqtt

- **One broker subscription per filter.** Any number of components can observe `sensors/+/temp`; the broker sees a single SUBSCRIBE.
- **Automatic cleanup.** When the last subscriber unsubscribes, ngx-mqtt sends the UNSUBSCRIBE for you.
- **Wildcard routing.** Messages are dispatched to every matching `+` and `#` filter.
- **Retained replay.** `observeRetained` hands the latest message to late subscribers instantly.
- **Modern Angular.** Standalone providers, a `connectionState` signal, zoneless ready, published with npm provenance.

## Install

```bash
npm install ngx-mqtt
```

| ngx-mqtt | Angular | MQTT.js |
| -------- | ------- | ------- |
| 22.x     | 21 - 23 | 5.x     |
| 17.x     | 14 - 17 | 4.x     |

## Quick start

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideMqtt } from 'ngx-mqtt';

export const appConfig: ApplicationConfig = {
  providers: [provideMqtt({ url: 'wss://broker.example.com/mqtt' })],
};
```

```ts
// temperature.ts
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MqttService } from 'ngx-mqtt';

@Component({
  selector: 'app-temperature',
  template: `
    <p>Kitchen: {{ temperature() ?? 'waiting...' }}</p>
    <button (click)="reset()">Reset</button>
  `,
})
export class Temperature {
  private readonly mqtt = inject(MqttService);

  protected readonly temperature = toSignal(
    this.mqtt
      .observe('home/kitchen/temperature')
      .pipe(map((message) => new TextDecoder().decode(message.payload))),
  );

  protected reset(): void {
    this.mqtt.unsafePublish('home/kitchen/reset', 'now');
  }
}
```

## Usage

### Retained messages

```ts
this.mqtt.observeRetained('home/status').subscribe((message) => console.log(message.topic));
```

### Connection state

```ts
readonly state = this.mqtt.connectionState;      // Signal<MqttConnectionState>
this.mqtt.state.subscribe((state) => { ... });  // Observable<MqttConnectionState>
```

### Connecting manually

```ts
provideMqtt({ url: 'wss://broker.example.com/mqtt', connectOnCreate: false });

this.mqtt.connect({ username: 'alice', password: token });
this.mqtt.disconnect();
```

### Publishing

```ts
this.mqtt.publish('home/light', 'on', { qos: 1 }).subscribe({
  complete: () => console.log('delivered'),
  error: (error) => console.error(error),
});
```

`publish` is lazy and sends when subscribed. `unsafePublish` sends immediately.

### Lifecycle events

`onConnect`, `onReconnect`, `onClose`, `onOffline`, `onError`, `onEnd`, `onMessage`, `onSuback`, `onPacketsend` and `onPacketreceive` are Observables.

### Logging

ngx-mqtt logs errors to the console by default. Change the level, silence it, or route entries to your own logger:

```ts
provideMqtt({ url, logLevel: 'warn' }); // 'debug' | 'info' | 'warn' | 'error' | 'silent'
provideMqtt({ url, logLevel: 'silent' });
provideMqtt({ url, logger: (entry) => myLogger.log(entry.level, entry.message, entry) });
```

Entries are structured (`level`, `event`, `message`, `clientId`, `timestamp`, `context`) and never contain payloads, credentials or URL userinfo.

### Custom client

```ts
import mqtt from 'mqtt';

provideMqtt({}, mqtt.connect('wss://broker.example.com/mqtt', { clientId: 'my-app' }));
```

## Configuration

`provideMqtt` accepts every [MQTT.js client option](https://github.com/mqttjs/MQTT.js#client) plus:

| Option            | Default     | Description                                                                  |
| ----------------- | ----------- | ---------------------------------------------------------------------------- |
| `url`             |             | Broker URL. When set, `protocol`, `hostname`, `port` and `path` are ignored. |
| `protocol`        | `ws`        | `ws` or `wss`.                                                               |
| `hostname`        | `localhost` | Broker host.                                                                 |
| `port`            |             | Broker websocket port.                                                       |
| `path`            |             | Websocket path, for example `/mqtt`.                                         |
| `connectOnCreate` | `true`      | Connect as soon as `MqttService` is created.                                 |
| `logLevel`        | `error`     | `debug`, `info`, `warn`, `error` or `silent`.                                |
| `logger`          | console     | Function receiving structured log entries.                                   |

Browsers can only open websockets, so only `ws` and `wss` brokers are supported; TLS client certificates (`key`, `cert`, `ca`) are not available.

## Upgrading from 17.x

See [MIGRATION.md](MIGRATION.md).

## Contributing

Open the repository in a Dev Container (VS Code, JetBrains or Codespaces) to get Node 24 and a Mosquitto broker with no local setup. Without the container:

```bash
docker compose up -d mosquitto
npm ci
npm test                  # unit tests
npx playwright install chromium
npm run test:integration  # browser tests against Mosquitto
npm start                 # demo app on http://localhost:4200
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org); releases are created automatically.

## License

[MIT](LICENSE)
