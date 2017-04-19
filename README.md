# ngx-mqtt [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt) [![Travis](https://img.shields.io/travis/sclausen/ngx-mqtt.svg)](https://travis-ci.org/sclausen/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular >= 2.
It uses observables and takes care of subscription handling and message routing.

* [Description](#description)
* [Installation](#installation)
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

```sh
npm install ngx-mqtt --save
```

## Run Demo Application
```sh
npm i              # install all dependencies
npm run build      # build the library
npm run serve:demo # start a local http server to run the demo module
```
If you change something in the code of the library (anything in the `src` folder), you have to rerun `npm run build` to see the changes. Changes in `demo.module.ts` only require a page refresh.

## Usage

``` typescript
import { Observable } from 'rxjs/Observable';

import {
  MqttMessage,
  MqttModule,
  MqttService
} from 'ngx-mqtt';

export const MQTT_SERVICE_OPTIONS = {
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

```
npm test
```
