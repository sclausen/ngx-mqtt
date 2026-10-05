# ngx-mqtt modernization design

Date: 2026-10-05
Status: Draft, pending review

## Goal

Bring ngx-mqtt to the current state of Angular library development and release it as a new major version:

1. Built and published the way Angular libraries are done today (current CLI, ng-packagr, APF, automated releases with provenance).
2. Built on MQTT.js v5 instead of the abandoned `mqtt-browser`.
3. Developed in a reproducible, isolated environment (Dev Container plus Docker Compose).
4. Documented with a modern README and a migration guide for users of 17.x.

The core value proposition stays unchanged: ref-counted MQTT subscriptions exposed as Observables, one broker subscription per filter shared across consumers.

## Non-goals

- Server-side (Node TCP) support. The library remains browser-only (`ws`/`wss`).
- New messaging features beyond what exists today (no request/response helpers, no MQTT 5 property helpers).
- A docs website. The README and MIGRATION.md are the documentation.

## Versioning and compatibility

- Package version: next major aligned with Angular, `22.0.0`.
- Peer dependencies: `@angular/core` and `@angular/common` `>=21.0.0 <24.0.0`, `rxjs` `^7.8.0`.
- Dependencies: `mqtt` `^5`, `tslib` `^2`.
- Removed dependencies: `mqtt-browser`, `mqtt-packet`, `url`, `zone.js`, `@angular/router`, `@angular/platform-browser-dynamic`.
- The peer range is enforced by a CI matrix that runs the unit tests against Angular 21 and 22.

## 1. Workspace and tooling

The workspace is regenerated with the current Angular CLI (`ng new ngx-mqtt --no-create-application`, `ng g library ngx-mqtt`, `ng g application demo`) and the library source is ported into it. An in-place `ng update` from 17 is not used.

Target layout:

```
.devcontainer/devcontainer.json
compose.yaml
mosquitto/mosquitto.conf
.github/workflows/ci.yml
.github/workflows/release.yml
.github/ISSUE_TEMPLATE/            (kept)
projects/ngx-mqtt/                 library
projects/demo/                     minimal zoneless standalone app
angular.json
tsconfig.json, tsconfig.*.json
eslint.config.js
.prettierrc
release-please-config.json
.release-please-manifest.json
README.md
MIGRATION.md
CHANGELOG.md                       (kept, continued by release-please)
LICENSE
```

Removed: `.travis.yml`, `mosquitto.sh`, `webpack.config.js`, `.vscode/tasks.json`, `.vscode/launch.json`, `projects/ngx-mqtt/README.md`, `projects/ngx-mqtt/LICENSE` (both copied from the root at build time via ng-package `assets`).

Tooling:

- Package manager: npm, pinned through `packageManager` and `engines` (Node 22 LTS) in the root `package.json`.
- Lint: angular-eslint with flat config. Format: Prettier.
- Library build: ng-packagr via `@angular/build:ng-packagr`, producing APF output (FESM2022, `exports` map, typings, `sideEffects: false`).
- Root scripts: `build`, `lint`, `format`, `test`, `test:integration`, `start` (serves demo).

The demo app is zoneless, standalone, and consumes the library through the workspace path mapping. It connects to the Compose broker, shows the connection state, lets the user subscribe to a filter and publish to a topic. It exists for manual testing only and is not published.

## 2. Library API and internals

### Public API

```ts
export function provideMqtt(options: MqttServiceOptions, client?: MqttClient): EnvironmentProviders;

/** @deprecated Use provideMqtt. Removed in the next major. */
export class MqttModule {
  static forRoot(options: MqttServiceOptions, client?: MqttClient): ModuleWithProviders<MqttModule>;
}

export class MqttService {
  readonly state: Observable<MqttConnectionState>;
  readonly connectionState: Signal<MqttConnectionState>;
  readonly messages: Observable<IMqttMessage>;

  readonly onConnect: Observable<IOnConnectEvent>;
  readonly onReconnect: Observable<void>;
  readonly onClose: Observable<void>;
  readonly onOffline: Observable<void>;
  readonly onError: Observable<IOnErrorEvent>;
  readonly onEnd: Observable<void>;
  readonly onMessage: Observable<Packet>;
  readonly onSuback: Observable<IOnSubackEvent>;
  readonly onPacketsend: Observable<IOnPacketsendEvent>;
  readonly onPacketreceive: Observable<IOnPacketreceiveEvent>;

  get clientId(): string;
  observables: Record<string, Observable<IMqttMessage>>;

  connect(opts?: MqttServiceOptions, client?: MqttClient): void;
  disconnect(force?: boolean): void;
  observe(filter: string, opts?: IClientSubscribeOptions): Observable<IMqttMessage>;
  observeRetained(filter: string, opts?: IClientSubscribeOptions): Observable<IMqttMessage>;
  publish(topic: string, message: string | Uint8Array, opts?: IClientPublishOptions): Observable<void>;
  unsafePublish(topic: string, message: string | Uint8Array, opts?: IClientPublishOptions): void;

  static filterMatchesTopic(filter: string, topic: string): boolean;
}

export function filterMatchesTopic(filter: string, topic: string): boolean;
export enum MqttConnectionState { CLOSED, CONNECTING, CONNECTED }
export const MqttServiceConfig: InjectionToken<MqttServiceOptions>;
export const MqttClientService: InjectionToken<MqttClient | undefined>;
```

- `MqttServiceOptions` extends MQTT.js v5 `IClientOptions` with `connectOnCreate`, `hostname`, `port`, `path`, `protocol` (`'ws' | 'wss'`), `url`. `IMqttServiceOptions` remains as a deprecated type alias.
- `IMqttMessage` is based on MQTT.js v5 `IPublishPacket`. The other `I*` types are kept as aliases or re-declared on top of `mqtt` v5 types so existing imports compile.
- `Packet` is imported from `mqtt` (re-exported from mqtt-packet by MQTT.js), so `mqtt-packet` is no longer a direct dependency.
- `MqttService` stays `providedIn: 'root'` and reads its configuration via `inject(MqttServiceConfig)` and `inject(MqttClientService, { optional: true })`. Using the service without `provideMqtt` or `forRoot` throws a clear error naming `provideMqtt`.
- URL building is unchanged: `url` wins, otherwise `${protocol ?? 'ws'}://${hostname ?? 'localhost'}[:port][path]`.

### Internals

- Import `connect` and types from `mqtt`. Its `exports` map resolves the `browser` condition to `dist/mqtt.esm.js`, so no polyfills or bundler configuration are required by consumers.
- Event streams are private `Subject`s exposed via `asObservable()`. `state` is a private `BehaviorSubject`. `connectionState` is a `signal` updated alongside it and exposed with `asReadonly()`.
- `observe` uses `share()`. `observeRetained` uses `shareReplay({ bufferSize: 1, refCount: true })`. The `using()` resource factory performs the broker subscribe on first subscriber and unsubscribe on the last teardown, as today.
- `publish` uses `new Observable(...)` instead of `Observable.create`. The broker publish happens on subscription, as today.
- `inject(DestroyRef).onDestroy(...)` ends the client with `force = true` when the root injector is destroyed.
- Client ID generation uses `crypto.randomUUID()` (prefixed `ngx-mqtt-`) unless a `clientId` is configured.
- No dependency on zone.js. The library works in zoneless applications.

### Behavior fixes

1. Remove the manual resubscription in the `connect` and `reconnect` handlers. MQTT.js v5 resubscribes on reconnect itself (`resubscribe: true` by default), and the old code duplicated subscriptions and only ran when `connectOnCreate === true`.
2. Do not mutate the injected options. Merging happens into a fresh object.
3. Remove `console.error` from the error handler. Errors are delivered through `onError` only.
4. Replace `(client as any).stream.on('error', ...)` with a typed, guarded attachment that only registers when `client.stream` exists.

## 3. Dev environment, tests, CI and release

### Dev environment

`compose.yaml`:

- `dev`: `mcr.microsoft.com/devcontainers/typescript-node:22`, workspace mounted, `sleep infinity`.
- `mosquitto`: `eclipse-mosquitto:2`, ports 9001 (websockets) and 1883 (tcp), config from `mosquitto/mosquitto.conf`, healthcheck via `mosquitto_sub` on `$SYS/#`.

`.devcontainer/devcontainer.json` uses the `dev` service, runs `npm ci` as `postCreateCommand`, forwards 4200 and 9001, and installs the ESLint, Prettier and Angular Language Service extensions.

Hosts without the container run `docker compose up mosquitto` and use their own Node 22.

The broker host for integration tests is read from `MQTT_HOST` (default `localhost`). The Dev Container sets `MQTT_HOST=mosquitto`.

### Unit tests (`npm test`)

Vitest through `@angular/build:unit-test`, jsdom environment, no broker. A `FakeMqttClient` test helper (Node `EventEmitter` based, implementing the subset of `MqttClient` the service uses and recording `subscribe`/`unsubscribe`/`publish` calls) is injected through `MqttClientService`.

Covered:

- one broker subscribe per filter across multiple observers; unsubscribe on last teardown; observable removed from `observables`
- `observeRetained` replays the last message to late subscribers
- SUBACK with qos 128 errors the observable and emits `onSuback` with `granted: false`
- `filterMatchesTopic` table-driven against the MQTT spec cases (`#`, `+`, `$` topics, empty levels)
- `publish` completes on success, errors on failure, does nothing until subscribed
- `unsafePublish` throws on error
- `state` and `connectionState` transitions on connect, reconnect, close
- injected options are not mutated by `connect`
- client is ended when the injector is destroyed
- `provideMqtt` and `MqttModule.forRoot` yield equivalent providers
- missing configuration throws the documented error

### Integration tests (`npm run test:integration`)

Separate Vitest configuration in browser mode (Playwright provider, Chromium), connecting to `ws://${MQTT_HOST}:9001`. Each run uses a unique topic prefix. Covered: connect, subscribe and receive, wildcard filters, retained messages, publish, resubscribe after a forced reconnect (no duplicate deliveries), clean disconnect.

### CI (`.github/workflows/ci.yml`)

Triggers: pull requests and pushes to `master`.

Jobs:

- `lint`: eslint and prettier check.
- `unit`: matrix over Angular 21 and 22 (installs the matrix version of `@angular/*` before running).
- `build`: `ng build ngx-mqtt`, `npm pack` of `dist/ngx-mqtt`, checked with `publint` and `@arethetypeswrong/cli`. Uploads the tarball as an artifact.
- `integration`: needs `build`; Mosquitto service container with the repo config; installs Playwright Chromium; runs `test:integration`.

### Release (`.github/workflows/release.yml`)

- release-please (`release-type: node`, package path at the root, version applied to `projects/ngx-mqtt/package.json` via `extra-files`) maintains a release PR with version bump and CHANGELOG from conventional commits.
- On release creation: build, run unit tests, `npm publish dist/ngx-mqtt --provenance --access public` using npm trusted publishing (OIDC, `id-token: write`). No `NPM_TOKEN` secret.
- One-time manual step: configure this repository and workflow as trusted publisher for `ngx-mqtt` on npmjs.com.

## 4. Documentation

### README.md

Plain Markdown, no emoji, readable in about a minute:

1. Name, one-line pitch, badges (npm version, CI, provenance, license).
2. Why ngx-mqtt: shared ref-counted subscriptions, automatic unsubscribe, wildcard routing, retained replay, zoneless and signal ready.
3. Install and compatibility table (ngx-mqtt major, Angular range, MQTT.js major).
4. Quick start: `provideMqtt` in `app.config.ts` and one component observing a topic with `toSignal` and publishing.
5. Usage: retained messages, connection state (Observable and Signal), manual connect, lifecycle events, custom client.
6. Configuration table for ngx-mqtt specific options, link to MQTT.js for the rest, note on `ws`/`wss` only.
7. Upgrading from 17.x: link to MIGRATION.md.
8. Contributing: Dev Container or `docker compose up mosquitto`, then test, integration test and demo commands.
9. License.

The root README is copied into the package at build time. The link to the old gh-pages homepage is removed.

### MIGRATION.md

"Upgrading from 17.x to 22.x" with one entry per breaking change, each with a before/after snippet:

- `MqttModule.forRoot` to `provideMqtt` (old API deprecated, still works)
- `EventEmitter` getters to `Observable`
- `state` and `messages` read-only; new `connectionState` signal
- `mqtt-browser` and `mqtt-packet` types to `mqtt` v5 types
- resubscription now handled by MQTT.js
- errors no longer logged to `console.error`
- injected options no longer mutated
- peer range Angular 21 to 23, Node 22 for development
- Buffer and `url` polyfills no longer required

The CHANGELOG entry for 22.0.0 links to MIGRATION.md.

## Success criteria

- `npm ci && npm run lint && npm test && npm run build` pass in the Dev Container and in CI.
- Integration suite passes against the Compose and CI Mosquitto.
- Packed tarball passes `publint` and `@arethetypeswrong/cli`.
- Demo app runs zoneless and exchanges messages with the broker.
- Unit tests pass against Angular 21 and 22.
- README and MIGRATION.md cover every item listed above.
