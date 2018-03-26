# ngx-mqtt [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt) [![Travis](https://img.shields.io/travis/sclausen/ngx-mqtt.svg)](https://travis-ci.org/sclausen/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular >= 2.
It uses observables and takes care of subscription handling and message routing.

* [Description](#description)
* [Installation](#installation)
* [Important Note](#important-note)
* [Run the Demo Application](#run-the-demo-application)
* [Usage](#usage)
* [Test](#test)

## Description

ngx-mqtt is well suited for applications with many components and many subscribers.
The problem is, if you regulary subscribe to mqtt with client libraries like `MQTT.js`, still every message is handled with an on-message-eventhandler, so you have to dispatch the received messages for yourself.
So, if you have multiple components using mqtt in your code, you just want to only receive the messages for your local filter.
Furthermore, if you destroy a component, you want to unsubscribe from mqtt, but only if no other component uses the same filter.

This library exposes a method `observe(filter)`, which returns an Observable. If you subscribe to this observable, the actual mqtt subscription is executed. The topic filter is used to only add matching mqtt messages to the observable. Every other execution of `observe(filter)` with an already used filter will return the same observable. The observable keeps track of the subscribers and executes an mqtt unsubscribe method, if all subscribers have unsubscribed from the observable.

## Installation

Simply install it from npm:

``` sh
npm install ngx-mqtt --save
```

## Important Note

Since most of the opened issues here are caused by misconfiguration, please make sure your broker listens on websocket and you've configured the right port for it.

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

## Run the Demo Application

``` sh
npm run serve:demo # go into demo folder, install npm dependencies and run ng serve
```

Keep in mind, that the demo is a self contained @angular/cli application, which depends on a ngx-mqtt release and not the source code.

## Usage

``` typescript
import { Observable } from 'rxjs/Observable';

import {
  MqttMessage,
  MqttModule,
  MqttService,
  MqttServiceOptions
} from 'ngx-mqtt';

export const MQTT_SERVICE_OPTIONS: MqttServiceOptions = {
  hostname: 'localhost',
  port: 9001,
  path: '/mqtt'
};

export function mqttServiceFactory() {
  return new MqttService(MQTT_SERVICE_OPTIONS);
}

@NgModule({
  imports: [
    ...
    MqttModule.forRoot({
      provide: MqttService,
      useFactory: mqttServiceFactory
    })
  ]
  ...
})

export class AppModule { }

@Component({
  template: `
    <h1>{{mesage}}</h1>
    <h1>{{(myOtherMessage$ | async)?.payload.toString()}}</h1>
  `
})
export class ExampleComponent {
  public myOtherMessage$: Observable<MqttMessage>;

  constructor(private _mqttService: MqttService) {
    this._mqttService.observe('my/topic').subscribe((message: MqttMessage) => {
      this.myMessage = message.payload.toString();
    });
    this.myOtherMessage$ = this._mqttService.observe('my/other/topic');
  }

  public unsafePublish(topic: string, message: string): void {
    this._mqttService.unsafePublish(topic, message, {qos: 1, retain: true});
  }
}
```

For further usage use this module, see `demo.module.ts` and `index.html`.

## Documentation

```sh
npm run docs       # build the documentation
npm run serve:docs # open a local webserver serving the documentation
```

## Test

``` sh
npm test
```
