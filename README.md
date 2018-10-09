# [ngx-mqtt]({{site.github.repository_url}}) [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt) [![Travis](https://img.shields.io/travis/sclausen/ngx-mqtt.svg)](https://travis-ci.org/sclausen/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular >= 2.
It uses observables and takes care of subscription handling and message routing.

* [Description](#description)
* [Installation](#installation)
* [Important Note](#important-note)
* [Usage](#usage)
* [Test](#test)

## Description

ngx-mqtt is well suited for applications with many components and many subscribers.
The problem is, if you regularly subscribe to mqtt with client libraries like `MQTT.js`, still every message is handled with an on-message-event-handler, so you have to dispatch the received messages for yourself.
So, if you have multiple components using mqtt in your code, you just want to only receive the messages for your local filter.
Furthermore, if you destroy a component, you want to unsubscribe from mqtt, but only if no other component uses the same filter.

This library exposes a method `observe(filter)` and `observeRetained(filter)`, which return an Observable. If you subscribe to one of this observables, the actual mqtt subscription is executed. The topic filter is used to only add matching mqtt messages to the observable. Every other execution of `observe(filter)` and `observeRetained(filter)` with an already used filter will return the same observable. The observable keeps track of the subscribers and executes an mqtt unsubscribe method, if all subscribers have unsubscribed from the observable.

The difference between `observe(filter)` and `observeRetained(filter)` is that the latter will emit the latest received message to new subscribers. 

## Installation

Simply install it from npm:

``` sh
npm install ngx-mqtt --save
```

## Important Note

Since most of the opened issues here are caused by misconfiguration, please make sure your broker listens on websockets and you've configured the right port for it.

Since ngx-mqtt is eventually just a wrapper around [MQTT.js](https://github.com/mqttjs/MQTT.js) (a smart one though), please make sure you're able to connect to your broker via plain MQTT.js in the browser before opening any issues here. If the following doesn't work, [stackoverflow.com](https://stackoverflow.com) is a great place to ask for help.

<iframe width="100%" height="400" src="//jsfiddle.net/tmyq2k7t/2/embedded/html,result/dark/" allowpaymentrequest allowfullscreen="allowfullscreen" frameborder="0"></iframe>

mosquitto seems to be the most common broker, so here is an example configuration with websockets.

    pid_file /var/run/mosquitto.pid

    persistence true
    persistence_location /var/lib/mosquitto/

    log_dest file /var/log/mosquitto/mosquitto.log

    listener 1883

    listener 9001 127.0.0.1
    protocol websockets

    include_dir /etc/mosquitto/conf.d

With this config the broker listens on `1883` for tcp connections and `9001` for websocket connections.

## Usage

``` typescript
import { Observable } from 'rxjs';

import {
  IMqttMessage,
  MqttModule,
  IMqttServiceOptions
} from 'ngx-mqtt';

export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  hostname: 'localhost',
  port: 9001,
  path: '/mqtt'
};

@NgModule({
  imports: [
    ...
    MqttModule.forRoot(MQTT_SERVICE_OPTIONS)
  ]
  ...
})

export class AppModule { }

@Component({
  template: `
    <h1>{{message}}</h1>
  `
})
export class ExampleComponent implements OnDestroy {
  private subscription: Subscription;
  public message: string;

  constructor(private _mqttService: MqttService) {
    this.subscription = this._mqttService.observe('my/topic').subscribe((message: IMqttMessage) => {
      this.message = message.payload.toString();
    });
  }

  public unsafePublish(topic: string, message: string): void {
    this._mqttService.unsafePublish(topic, message, {qos: 1, retain: true});
  }

  public ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
```

## API Documentation

```sh
npm run docs       # build the documentation
npm run serve:docs # open a local webserver serving the documentation
```

## Test
You need a mqtt broker which listens on port 9001 for websockets.
``` sh
npm test
```
