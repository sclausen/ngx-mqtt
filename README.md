# ngx-mqtt [![npm](https://img.shields.io/npm/v/ngx-mqtt.svg)](https://www.npmjs.com/package/ngx-mqtt) [![Travis](https://img.shields.io/travis/sclausen/ngx-mqtt.svg)](https://travis-ci.org/sclausen/ngx-mqtt)

This library isn't just a wrapper around MQTT.js for angular >= 2.
It uses observables and takes care of subscription handling and message routing.

For reasons of convenience, I removed the copied typings from mqtt.js and added it as a dev-dependency while still bundling the browserified latest version of it.
This means although you have the possibility to use `mqtt`, `mqtts`, `tcp`, `ssl`, `wx` or `wxs` as the protocol in the client options, you can't, because this is a browser library where you can't conntect with something other than websockets. You also can't use `key`, `cert` and `ca` for the same reasons.

If you have any issues using this library, please visit it's [homepage](https://sclausen.github.io/ngx-mqtt/) and look for similar issues in the issue tracker before you file a bug.

## **ngx-mqtt >= 7 is only compatible with angular >= 9**

## Local development
For local development all peer dependency automatically installed during install.
Also please be aware that exact MQTT version used as dependency, you need to manually bump it if it will update.

## Publish new version
To follow semver helper scripts was added `npm run release:patch` etc.
Those commands will autoupdate changelog and dependant package.json's

Unfortunately command `npm publish` is broken due to nature of ng-packager. 
It's substituted with `npm run publish`, which will correctly build and publish production build

## Webpack shimming

ngx-mqtt depends on mqtt package which uses node globals.
In order to make it run inside browser it includes a postinstall script which patches Angular webpack config of the project it was imported into.
To disable this, you have to set `MQTT_DISABLE_HOOK` environmental variable while installing this package.
`MQTT_DISABLE_HOOK=true npm i`

