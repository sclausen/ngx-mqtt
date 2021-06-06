# ngx-mqtt [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt) [![Travis](https://img.shields.io/travis/sclausen/ngx-mqtt.svg)](https://travis-ci.org/sclausen/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular.
It uses observables and takes care of subscription handling and message routing.

Since it's based on the browserified version of mqtt.js, this means although you have the possibility to use `mqtt`, `mqtts`, `tcp`, `ssl`, `wx` or `wxs` as the protocol in the client options, you can't use it, because this is a browser library where you can't conntect with mqtt directly via tcp, but with websockets. You also can't use `key`, `cert` and `ca` for the same reasons.

If you have any issues using this library, please visit it's [homepage](https://sclausen.github.io/ngx-mqtt/) and look for similar issues in the issue tracker before you file a bug.

## **ngx-mqtt >= 7 is only compatible with angular >= 9**

## Local development
For local development all peer dependency automatically installed during install.
