import { DestroyRef, Injectable, type Signal, inject, signal } from '@angular/core';
import {
  connect as mqttConnect,
  type IClientPublishOptions,
  type IClientSubscribeOptions,
  type IConnackPacket,
  type IPublishPacket,
  type ISubscriptionGrant,
  type MqttClient,
  type Packet,
} from 'mqtt';
import {
  BehaviorSubject,
  filter,
  merge,
  type MonoTypeOperatorFunction,
  Observable,
  share,
  shareReplay,
  Subject,
} from 'rxjs';
import type { MqttInternalEvent } from './mqtt.internal';
import { startLogging } from './mqtt.logger';
import {
  type IMqttMessage,
  type IOnConnectEvent,
  type IOnErrorEvent,
  type IOnPacketreceiveEvent,
  type IOnPacketsendEvent,
  type IOnSubackEvent,
  MqttConnectionState,
  type MqttPayload,
  type MqttServiceOptions,
} from './mqtt.model';
import { generateClientId, mergeOptions, resolveUrl, toClientOptions } from './mqtt.options';
import { MqttClientService, MqttServiceConfig } from './mqtt.tokens';
import { filterMatchesTopic } from './topic-filter';

export const MISSING_CONFIG_ERROR =
  'ngx-mqtt: no configuration found. Add provideMqtt(options) to your application providers.';
const NOT_CONNECTED_ERROR = 'mqtt client not connected';

interface SubackPacketLike {
  granted?: unknown;
}

interface ErrorWithPacket extends Error {
  packet?: SubackPacketLike;
}

interface ActiveSubscription {
  opts: IClientSubscribeOptions;
  rejected: Subject<never>;
}

@Injectable({ providedIn: 'root' })
export class MqttService {
  static readonly filterMatchesTopic = filterMatchesTopic;

  private readonly options: MqttServiceOptions;
  private client: MqttClient | undefined;
  private _clientId: string;
  private readonly active = new Map<string, ActiveSubscription>();
  private readonly internalEvents = new Subject<MqttInternalEvent>();

  private readonly _state = new BehaviorSubject(MqttConnectionState.CLOSED);
  private readonly _connectionState = signal(MqttConnectionState.CLOSED);
  private readonly _messages = new Subject<IMqttMessage>();
  private readonly _onConnect = new Subject<IOnConnectEvent>();
  private readonly _onReconnect = new Subject<void>();
  private readonly _onClose = new Subject<void>();
  private readonly _onOffline = new Subject<void>();
  private readonly _onError = new Subject<IOnErrorEvent>();
  private readonly _onEnd = new Subject<void>();
  private readonly _onMessage = new Subject<Packet>();
  private readonly _onSuback = new Subject<IOnSubackEvent>();
  private readonly _onPacketsend = new Subject<IOnPacketsendEvent>();
  private readonly _onPacketreceive = new Subject<IOnPacketreceiveEvent>();

  readonly state: Observable<MqttConnectionState> = this._state.asObservable();
  readonly connectionState: Signal<MqttConnectionState> = this._connectionState.asReadonly();
  readonly messages: Observable<IMqttMessage> = this._messages.asObservable();
  readonly onConnect: Observable<IOnConnectEvent> = this._onConnect.asObservable();
  readonly onReconnect: Observable<void> = this._onReconnect.asObservable();
  readonly onClose: Observable<void> = this._onClose.asObservable();
  readonly onOffline: Observable<void> = this._onOffline.asObservable();
  readonly onError: Observable<IOnErrorEvent> = this._onError.asObservable();
  readonly onEnd: Observable<void> = this._onEnd.asObservable();
  readonly onMessage: Observable<Packet> = this._onMessage.asObservable();
  readonly onSuback: Observable<IOnSubackEvent> = this._onSuback.asObservable();
  readonly onPacketsend: Observable<IOnPacketsendEvent> = this._onPacketsend.asObservable();
  readonly onPacketreceive: Observable<IOnPacketreceiveEvent> =
    this._onPacketreceive.asObservable();

  observables: Record<string, Observable<IMqttMessage>> = {};

  constructor() {
    const options = inject(MqttServiceConfig, { optional: true });
    if (!options) {
      throw new Error(MISSING_CONFIG_ERROR);
    }
    const client = inject(MqttClientService, { optional: true }) ?? undefined;
    this.options = options;
    this._clientId = options.clientId ?? generateClientId();
    const logging = startLogging(this, this.internalEvents, options, () => this._clientId);
    inject(DestroyRef).onDestroy(() => {
      logging.unsubscribe();
      this.client?.end(true);
    });
    if (options.connectOnCreate !== false) {
      this.connect({}, client);
    }
  }

  get clientId(): string {
    return this._clientId;
  }

  connect(opts?: MqttServiceOptions, client?: MqttClient): void {
    const merged = mergeOptions(
      { clientId: this._clientId, reconnectPeriod: 10000, connectTimeout: 10000 },
      this.options,
      opts,
    );
    this._clientId = merged.clientId ?? this._clientId;
    const previous = this.client;
    this.setState(MqttConnectionState.CONNECTING);
    this.client = client ?? mqttConnect(resolveUrl(merged), toClientOptions(merged));
    previous?.end(true);
    this.bind(this.client);
    this.active.forEach((subscription, filterString) =>
      this.brokerSubscribe(filterString, subscription),
    );
  }

  disconnect(force = true): void {
    this.requireClient().end(force);
  }

  observe(
    filterString: string,
    opts: IClientSubscribeOptions = { qos: 1 },
  ): Observable<IMqttMessage> {
    return this.generalObserve(filterString, share(), opts);
  }

  observeRetained(
    filterString: string,
    opts: IClientSubscribeOptions = { qos: 1 },
  ): Observable<IMqttMessage> {
    return this.generalObserve(filterString, shareReplay({ bufferSize: 1, refCount: true }), opts);
  }

  private generalObserve(
    filterString: string,
    sharing: MonoTypeOperatorFunction<IMqttMessage>,
    opts: IClientSubscribeOptions,
  ): Observable<IMqttMessage> {
    this.requireClient();
    const existing = this.observables[filterString];
    if (existing) {
      return existing;
    }
    const observable: Observable<IMqttMessage> = new Observable<IMqttMessage>((subscriber) => {
      const entry: ActiveSubscription = { opts, rejected: new Subject<never>() };
      this.active.set(filterString, entry);
      this.internalEvents.next({ type: 'subscribe', filter: filterString });
      this.brokerSubscribe(filterString, entry);
      const inner = merge(entry.rejected, this._messages)
        .pipe(filter((message) => filterMatchesTopic(filterString, message.topic)))
        .subscribe(subscriber);
      return () => {
        inner.unsubscribe();
        this.active.delete(filterString);
        if (this.observables[filterString] === observable) {
          delete this.observables[filterString];
        }
        this.internalEvents.next({ type: 'unsubscribe', filter: filterString });
        this.client?.unsubscribe(filterString);
      };
    }).pipe(sharing);
    this.observables[filterString] = observable;
    return observable;
  }

  private brokerSubscribe(filterString: string, entry: ActiveSubscription): void {
    this.client?.subscribe(
      filterString,
      entry.opts,
      (error: Error | null, granted?: ISubscriptionGrant[], packet?: SubackPacketLike) => {
        const reasonCodes = (packet ?? (error as ErrorWithPacket | null)?.packet)?.granted;
        const rejected = Array.isArray(reasonCodes)
          ? reasonCodes.some((code) => (code & 0x80) !== 0)
          : (granted?.some((grant) => grant.qos >= 128) ?? false);
        if (rejected) {
          this._onSuback.next({ filter: filterString, granted: false });
          entry.rejected.error(new Error(`subscription for '${filterString}' rejected!`));
        } else if (!error) {
          this._onSuback.next({ filter: filterString, granted: true });
        }
      },
    );
  }

  publish(
    topic: string,
    message: MqttPayload,
    options: IClientPublishOptions = {},
  ): Observable<void> {
    const client = this.requireClient();
    return new Observable<void>((subscriber) => {
      client.publish(topic, message, options, (error?: Error) => {
        if (error) {
          this.internalEvents.next({ type: 'publishError', topic, error });
          subscriber.error(error);
        } else {
          subscriber.next();
          subscriber.complete();
        }
      });
    });
  }

  unsafePublish(topic: string, message: MqttPayload, options: IClientPublishOptions = {}): void {
    this.requireClient().publish(topic, message, options, (error?: Error) => {
      if (error) {
        this.internalEvents.next({ type: 'publishError', topic, error });
        throw error;
      }
    });
  }

  private requireClient(): MqttClient {
    if (!this.client) {
      throw new Error(NOT_CONNECTED_ERROR);
    }
    return this.client;
  }

  private setState(state: MqttConnectionState): void {
    this._state.next(state);
    this._connectionState.set(state);
  }

  private bind(client: MqttClient): void {
    const when =
      <A extends unknown[]>(handler: (...args: A) => void) =>
      (...args: A): void => {
        if (client === this.client) {
          handler(...args);
        }
      };
    client.on(
      'connect',
      when((packet: IConnackPacket) => {
        this.setState(MqttConnectionState.CONNECTED);
        this._onConnect.next(packet);
      }),
    );
    client.on(
      'reconnect',
      when(() => {
        this.setState(MqttConnectionState.CONNECTING);
        this._onReconnect.next();
      }),
    );
    client.on(
      'close',
      when(() => {
        this.setState(MqttConnectionState.CLOSED);
        this._onClose.next();
      }),
    );
    client.on(
      'offline',
      when(() => this._onOffline.next()),
    );
    client.on(
      'error',
      when((error: IOnErrorEvent) => this._onError.next(error)),
    );
    client.stream?.on?.(
      'error',
      when((error: IOnErrorEvent) => this._onError.next(error)),
    );
    client.on(
      'end',
      when(() => this._onEnd.next()),
    );
    client.on(
      'message',
      when((_topic: string, _payload: unknown, packet: IPublishPacket) => {
        this._onMessage.next(packet);
        this._messages.next(packet as unknown as IMqttMessage);
      }),
    );
    client.on(
      'packetsend',
      when((packet: Packet) => this._onPacketsend.next(packet)),
    );
    client.on(
      'packetreceive',
      when((packet: Packet) => this._onPacketreceive.next(packet)),
    );
  }
}
