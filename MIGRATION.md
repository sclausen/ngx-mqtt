# Upgrading from 17.x to 22.x

ngx-mqtt 22 targets Angular 21 to 23 and MQTT.js 5. Most applications only need step 1.

## 1. Register the service with `provideMqtt`

Before:

```ts
@NgModule({
  imports: [MqttModule.forRoot({ hostname: 'broker', port: 9001 })],
})
export class AppModule {}
```

After:

```ts
bootstrapApplication(App, {
  providers: [provideMqtt({ hostname: 'broker', port: 9001 })],
});
```

`MqttModule.forRoot` still works but is deprecated and will be removed in the next major version.

## 2. Events are Observables

`onConnect`, `onError`, `onMessage` and the other `on*` members were `EventEmitter`s. They are now read-only `Observable`s. `.subscribe()` works unchanged; calling `.emit()` no longer compiles.

## 3. `state` and `messages` are read-only

Before:

```ts
this.mqtt.state.next(MqttConnectionState.CLOSED);
```

After: not possible. Use `this.mqtt.state` (Observable) or the new `this.mqtt.connectionState` (Signal) to read the state.

## 4. Types come from MQTT.js 5

`mqtt-browser` and `mqtt-packet` are gone. Import client types from `mqtt` or use the aliases ngx-mqtt keeps exporting (`IMqttMessage`, `IPublishOptions`, `IOnConnectEvent`, ...). `IOnConnectEvent` is now the CONNACK packet type. `IMqttServiceOptions` is a deprecated alias of `MqttServiceOptions`.

If you create MQTT.js clients yourself, use the default import: `import mqtt from 'mqtt'` and `mqtt.connect(...)`; the browser build has no named exports.

## 5. Resubscription is handled by MQTT.js

17.x resubscribed all filters itself on every `connect` and `reconnect` when `connectOnCreate` was `true`, which could duplicate subscriptions. MQTT.js 5 restores subscriptions after a reconnect (`resubscribe: true` by default). ngx-mqtt only resubscribes when you replace the client by calling `connect()` again.

## 6. Logging is configurable

Errors are still written to the console by default. Turn it off or route it elsewhere:

```ts
provideMqtt({ ...options, logLevel: 'silent' });
provideMqtt({ ...options, logger: (entry) => myLogger.log(entry) });
```

## 7. Smaller changes

- The injected options object is no longer mutated by `connect()`.
- `MQTT_SERVICE_OPTIONS` was removed.
- Generated client IDs start with `ngx-mqtt-` instead of `client-`.
- A subscription rejected by the broker errors with an `Error` instead of a string.
- When `url` is set, `protocol`, `hostname`, `port` and `path` are no longer passed to MQTT.js.
- No polyfills or custom webpack config (`Buffer`, `url`) are needed any more; remove them.
- Peer dependencies: `@angular/core` and `@angular/common` `>=21 <24`, `rxjs` `^7.8`.
