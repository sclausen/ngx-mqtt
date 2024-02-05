# [ngx-mqtt](https://github.com/sclausen/ngx-mqtt) [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular. It uses observables and takes care of subscription handling and message routing so you do not manually have to unsubscribe and your components only get the messages corresponding to their topic filters.

- [ngx-mqtt ](#ngx-mqtt-)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Limitations](#limitations)
  - [Important Note](#important-note)

## Description[](#description)

ngx-mqtt is well suited for applications with many components and many subscribers. The challenge in such a system is, that if you regularly subscribe to mqtt with client libraries like `MQTT.js`, still every message is handled with an on-message-event-handler, so you have to dispatch the received messages for yourself. So, if you have multiple components using mqtt in your code, you just want to only receive the messages for your local topic filter. Furthermore, if you destroy a component, you want to unsubscribe from mqtt, but only if no other component uses the same filter.

This library exposes a method `observe(filter)` and `observeRetained(filter)`, which return an Observable. If you subscribe to one of this observables, the actual mqtt subscription is executed. The topic filter is used to only add matching mqtt messages to the observable. Every other execution of `observe(filter)` and `observeRetained(filter)` with an already used filter will return the same observable. The observable keeps track of the subscribers and executes an mqtt unsubscribe method, if all subscribers have unsubscribed from the observable.

The difference between `observe(filter)` and `observeRetained(filter)` is that the latter will emit the latest received message to new subscribers.

## Installation[](#installation)

Simply install it from npm:

```sh
npm i ngx-mqtt --save
```

## Usage[](#usage)

An example on how to use the library can be found in the [projects/example](projects/example) folder. You can serve the project with the following command:

```sh
npm run example
```

## Limitations[](#limitations)
As mentioned in the description, ngx-mqtt wraps [MQTT.js](https://github.com/mqttjs/MQTT.js). This means, that it has the same limitations as [MQTT.js](https://github.com/mqttjs/MQTT.js). The most important one is, that since it works in the browser it uses websockets instead of TCP. It also means, that client certificates are not supported. If your broker doesn't provide a websocket endpoint or you need to use client certificates, you can't use this library.

## Important Note[](#important-note)
Since misconfiguration is a common error, please make sure your broker listens on websockets and you've configured the right port for it.

Since ngx-mqtt is eventually just a wrapper around [MQTT.js](https://github.com/mqttjs/MQTT.js) (a smart one though), please make sure you're able to connect to your broker via plain MQTT.js in the browser before opening any issues here. If the following doesn't work, [stackoverflow.com](https://stackoverflow.com) is a great place to ask for help.

mosquitto seems to be the most common broker, so here is an example configuration with websockets.

```
pid_file /var/run/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

listener 1883

listener 9001 127.0.0.1
protocol websockets

include_dir /etc/mosquitto/conf.d
```

With this config the broker listens on `9001` for websocket connections used by this library and `1883` for tcp connections which you can use with any mqtt client GUI like [MQTT Explorer](https://mqtt-explorer.com/) to debug and evaluate the libraries behaviour.
