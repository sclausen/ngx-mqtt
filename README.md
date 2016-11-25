# angular2-mqtt [![npm version](https://img.shields.io/npm/v/angular2-mqtt.svg)](https://www.npmjs.com/package/angular2-mqtt)

This library isn't just a wrapper of MQTT.js for angular2.
It uses observables and takes care of subscription handling and message routing.

* [Installation](#installation)
* [Usage](#usage)
* [Test](#test)
* [Notes](#notes)

## Installation

Simply install it from npm:

```sh
npm install angular2-mqtt --save
```

## Usage
How to use this module, see `demo.module.ts` and `index.html`.

## Test

```
$ npm test
```

## Upgrade MQTT.js Version

To use a different version of MQTT.js, install the desired version of MQTT.js with `npm install mqtt@x.y.z` and browserify with `npm run browserify-mqtt`. Now you can build `angular2-mqtt` with `npm install`.



## Notes
This library uses MQTT.js `mqtt@2.1.3`.