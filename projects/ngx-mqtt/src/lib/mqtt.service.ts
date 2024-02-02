import { EventEmitter, Inject, Injectable, OnDestroy } from '@angular/core';
import mqtt from 'mqtt';
import { Packet, ISubackPacket } from 'mqtt-packet';
import {
  BehaviorSubject,
  firstValueFrom,
  from,
  merge,
  Observable,
  Observer,
  Subject,
  Subscriber,
  Subscription,
  Unsubscribable,
  using,
} from 'rxjs';
import {
  filter,
  publish,
  publishReplay,
  refCount,
  share,
  shareReplay,
} from 'rxjs/operators';

import { IMqttServiceOptions, MqttConnectionState } from './mqtt.model';
import { MqttClientService, MqttServiceConfig } from './mqtt.module';

// A javascript function that takes two objects and merges them recursively
function mergeDeep(target: any, ...sources: any[]): any {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

function isObject(item: any): item is Object {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * With an instance of MqttService, you can observe and subscribe to MQTT in multiple places, e.g. in different components,
 * to only subscribe to the broker once per MQTT filter.
 * It also handles proper unsubscription from the broker, if the last observable with a filter is closed.
 */
@Injectable({
  providedIn: 'root',
})
export class MqttService implements OnDestroy {
  private client!: mqtt.MqttClient;
  private stateSubscription: Subscription;

  /**
   * The constructor needs [connection options]{@link IMqttServiceOptions} regarding the broker and some
   * options to configure behavior of this service, like if the connection to the broker
   * should be established on creation of this service or not.
   */
  constructor(
    @Inject(MqttServiceConfig) private options: IMqttServiceOptions,
    @Inject(MqttClientService) client?: mqtt.MqttClient
  ) {
    this._clientId = this.generateClientId();
    if (options.connectOnCreate === true) {
      this.connect(options, client);
    }

    this.stateSubscription = this.state.subscribe();
  }

  ngOnDestroy(): void {
    this.client?.end(true);
    this.stateSubscription.unsubscribe();
  }

  /**
   * gets the _clientId
   */
  public get clientId() {
    return this._clientId;
  }

  /** An EventEmitter to listen to connect messages */
  public get onConnect(): EventEmitter<mqtt.IConnackPacket> {
    return this._onConnect;
  }

  public get onDisconnect(): EventEmitter<mqtt.IDisconnectPacket> {
    return this._onDisconnect;
  }

  /** An EventEmitter to listen to reconnect messages */
  public get onReconnect(): EventEmitter<void> {
    return this._onReconnect;
  }

  /** An EventEmitter to listen to close messages */
  public get onClose(): EventEmitter<void> {
    return this._onClose;
  }

  /** An EventEmitter to listen to offline events */
  public get onOffline(): EventEmitter<void> {
    return this._onOffline;
  }

  /** An EventEmitter to listen to error events */
  public get onError(): EventEmitter<Error | mqtt.ErrorWithReasonCode> {
    return this._onError;
  }

  /** An EventEmitter to listen to close messages */
  public get onEnd(): EventEmitter<void> {
    return this._onEnd;
  }

  /** An EventEmitter to listen to message events */
  public get onMessage(): EventEmitter<mqtt.IPublishPacket> {
    return this._onMessage;
  }

  /** An EventEmitter to listen to packetsend messages */
  public get onPacketsend(): EventEmitter<Packet> {
    return this._onPacketsend;
  }

  /** An EventEmitter to listen to packetreceive messages */
  public get onPacketreceive(): EventEmitter<Packet> {
    return this._onPacketreceive;
  }

  /** An EventEmitter to listen to suback events */
  public get onSuback(): EventEmitter<ISubackPacket> {
    return this._onSuback;
  }

  /** a map of all mqtt observables by filter */
  public observables: {
    [filterString: string]: Observable<mqtt.IPublishPacket>;
  } = {};
  /** the connection state */
  public state: Subject<MqttConnectionState> =
    new BehaviorSubject<MqttConnectionState>(MqttConnectionState.CLOSED);
  /** an observable of the last mqtt message */
  public messages: Subject<mqtt.IPublishPacket> =
    new Subject<mqtt.IPublishPacket>();

  private _clientId!: string;
  private _connectTimeout = 10000;
  private _reconnectPeriod = 10000;
  private _url!: string;

  private _onConnect: EventEmitter<mqtt.IConnackPacket> =
    new EventEmitter<mqtt.IConnackPacket>();
  private _onDisconnect: EventEmitter<mqtt.IDisconnectPacket> =
    new EventEmitter<mqtt.IDisconnectPacket>();
  private _onReconnect: EventEmitter<void> = new EventEmitter<void>();
  private _onClose: EventEmitter<void> = new EventEmitter<void>();
  private _onOffline: EventEmitter<void> = new EventEmitter<void>();
  private _onError: EventEmitter<Error | mqtt.ErrorWithReasonCode> =
    new EventEmitter<Error | mqtt.ErrorWithReasonCode>();
  private _onEnd: EventEmitter<void> = new EventEmitter<void>();
  private _onMessage: EventEmitter<mqtt.IPublishPacket> =
    new EventEmitter<mqtt.IPublishPacket>();
  private _onSuback: EventEmitter<ISubackPacket> =
    new EventEmitter<ISubackPacket>();
  private _onPacketsend: EventEmitter<Packet> = new EventEmitter<Packet>();
  private _onPacketreceive: EventEmitter<Packet> = new EventEmitter<Packet>();

  /**
   * This static method shall be used to determine whether a MQTT
   * topic matches a given filter. The matching rules are specified in the MQTT
   * standard documentation and in the library test suite.
   *
   * @param  {string}  filter A filter may contain wildcards like '#' and '+'.
   * @param  {string}  topic  A topic may not contain wildcards.
   * @return {boolean}        true on match and false otherwise.
   */
  public static filterMatchesTopic(
    filterString: string,
    topic: string
  ): boolean {
    if (filterString[0] === '#' && topic[0] === '$') {
      return false;
    }
    // Preparation: split and reverse on '/'. The JavaScript split function is sane.
    const fs = (filterString || '').split('/').reverse();
    const ts = (topic || '').split('/').reverse();
    // This function is tail recursive and compares both arrays one element at a time.
    const match = (): boolean => {
      // Cutting of the last element of both the filter and the topic using pop().
      const f = fs.pop();
      const t = ts.pop();
      switch (f) {
        // In case the filter level is '#', this is a match no matter whether
        // the topic is undefined on this level or not ('#' matches parent element as well!).
        case '#':
          return true;
        // In case the filter level is '+', we shall dive into the recursion only if t is not undefined.
        case '+':
          return t ? match() : false;
        // In all other cases the filter level must match the topic level,
        // both must be defined and the filter tail must match the topic
        // tail (which is determined by the recursive call of match()).
        default:
          return f === t && (f === undefined ? true : match());
      }
    };
    return match();
  }

  /**
   * connect manually connects to the mqtt broker.
   */
  public connect(opts?: IMqttServiceOptions, client?: mqtt.MqttClient) {
    const options = mergeDeep(this.options || {}, opts);
    const protocol = options.protocol || 'ws';
    const hostname = options.hostname || 'localhost';
    if (options.url) {
      this._url = options.url;
    } else {
      this._url = `${protocol}://${hostname}`;
      this._url += options.port ? `:${options.port}` : '';
      this._url += options.path ? `${options.path}` : '';
    }
    this.state.next(MqttConnectionState.CONNECTING);
    const mergedOptions = mergeDeep(
      {
        clientId: this._clientId,
        reconnectPeriod: this._reconnectPeriod,
        connectTimeout: this._connectTimeout,
      },
      options
    );

    if (this.client) {
      console.log(`this.client.end(true);`);
      this.client.end(true);
    }

    if (!client) {
      this.client = mqtt.connect(this._url, mergedOptions);
    } else {
      this.client = client;
    }
    this._clientId = mergedOptions.clientId;

    this.client.on('connect', this.handleOnConnect);
    this.client.on('disconnect', this.handleOnDisconnect);
    this.client.on('reconnect', this.handleOnReconnect);
    this.client.on('close', this.handleOnClose);
    this.client.on('offline', this.handleOnOffline);
    this.client.on('error', this.handleOnError);
    (this.client as any).stream.on('error', this.handleOnError);
    this.client.on('end', this.handleOnEnd);
    this.client.on('message', this.handleOnMessage);
    this.client.on('packetsend', this.handleOnPacketsend);
    this.client.on('packetreceive', this.handleOnPacketreceive);
  }

  /**
   * disconnect disconnects from the mqtt client.
   * This method `should` be executed when leaving the application.
   */
  public disconnect(force = true) {
    this.client?.end(force);
  }

  /**
   * With this method, you can observe messages for a mqtt topic.
   * The observable will only emit messages matching the filter.
   * The first one subscribing to the resulting observable executes a mqtt subscribe.
   * The last one unsubscribing this filter executes a mqtt unsubscribe.
   * Every new subscriber gets the latest message.
   */
  public observeRetained(
    filterString: string,
    opts: mqtt.IClientSubscribeOptions = { qos: 1 }
  ): Observable<mqtt.IPublishPacket> {
    return this.generalObserve(filterString, true, opts);
  }

  /**
   * With this method, you can observe messages for a mqtt topic.
   * The observable will only emit messages matching the filter.
   * The first one subscribing to the resulting observable executes a mqtt subscribe.
   * The last one unsubscribing this filter executes a mqtt unsubscribe.
   */
  public observe(
    filterString: string,
    opts: mqtt.IClientSubscribeOptions = { qos: 1 }
  ): Observable<mqtt.IPublishPacket> {
    return this.generalObserve(filterString, false, opts);
  }

  /**
   * With this method, you can observe messages for a mqtt topic.
   * The observable will only emit messages matching the filter.
   * The first one subscribing to the resulting observable executes a mqtt subscribe.
   * The last one unsubscribing this filter executes a mqtt unsubscribe.
   * Depending on the publish function, the messages will either be replayed after new
   * subscribers subscribe or the messages are just passed through
   */
  private generalObserve(
    filterString: string,
    isRetained: boolean,
    opts: mqtt.IClientSubscribeOptions
  ): Observable<mqtt.IPublishPacket> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    if (!this.observables[filterString]) {
      const observableFactory = (_resource: void | Unsubscribable) => {
        return merge(this.messages).pipe(
          filter((msg: mqtt.IPublishPacket) =>
            MqttService.filterMatchesTopic(filterString, msg.topic)
          )
        );
      };

      const sharedObservable = using(
        () => this.subscribeToTopic(filterString, opts),
        observableFactory
      ).pipe(isRetained ? shareReplay(1) : share());

      this.observables[filterString] = sharedObservable;
    }

    return this.observables[filterString];
  }

  private subscribeToTopic(
    filterString: string,
    opts: mqtt.IClientSubscribeOptions
  ): Subscription {
    const subscription = new Subscription();
    const rejected = new Subject<mqtt.IPublishPacket>();

    this.client.subscribe(filterString, opts, (_err, granted) => {
      if (granted && granted.length > 0) {
        const validGrants = granted.filter((grant) => grant.qos !== 128);
        const rejectedGrants = granted.filter((grant) => grant.qos === 128);

        if (validGrants.length > 0) {
          this._onSuback.emit({
            cmd: 'suback',
            granted: validGrants,
          });
        }

        rejectedGrants.forEach((grant) => {
          this.client.unsubscribe(grant.topic);
          delete this.observables[grant.topic];
          rejected.error(`Subscription for '${grant.topic}' rejected!`);
        });
      }
    });

    subscription.add(() => {
      this.client.unsubscribe(filterString);
      delete this.observables[filterString];
    });

    return subscription;
  }

  /**
   * This method returns an observable for a topic with optional options.
   * After subscribing, the actual mqtt publication will be executed and
   * the observable will emit an empty value and completes, if publishing was successful
   * or throws an error, if the publication fails.
   */
  public publish(
    topic: string,
    message: string | Buffer,
    options: mqtt.IClientPublishOptions = {}
  ): Promise<Packet | undefined> {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }

    return this.client.publishAsync(topic, message, options);
  }

  /**
   * This method publishes a message for a topic with optional options.
   * If an error occurs, it will throw.
   */
  public unsafePublish(
    topic: string,
    message: string | Buffer,
    options: mqtt.IClientPublishOptions = {}
  ): void {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    this.client.publish(topic, message, options, (error: Error | undefined) => {
      if (error) {
        throw error;
      }
    });
  }

  private handleOnConnect = (e: mqtt.IConnackPacket) => {
    if (this.options.connectOnCreate === true) {
      Object.keys(this.observables).forEach((filterString: string) => {
        this.client.subscribe(filterString);
      });
    }
    this.state.next(MqttConnectionState.CONNECTED);
    this._onConnect.emit(e);
  };

  private handleOnDisconnect = (e: mqtt.IDisconnectPacket) => {
    this.state.next(MqttConnectionState.CLOSED);
    this._onDisconnect.emit(e);
  };

  private handleOnReconnect = () => {
    if (this.options.connectOnCreate === true) {
      Object.keys(this.observables).forEach((filterString: string) => {
        this.client.subscribe(filterString);
      });
    }
    this.state.next(MqttConnectionState.CONNECTING);
    this._onReconnect.emit();
  };

  private handleOnClose = () => {
    this.state.next(MqttConnectionState.CLOSED);
    this._onClose.emit();
  };

  private handleOnOffline = () => {
    this._onOffline.emit();
  };

  private handleOnError: mqtt.OnErrorCallback = (error) => {
    this._onError.emit(error);
    console.error(error);
  };

  private handleOnEnd = () => {
    this._onEnd.emit();
  };

  private handleOnMessage: mqtt.OnMessageCallback = (
    _topic: string,
    _payload: Buffer,
    packet: mqtt.IPublishPacket
  ) => {
    this._onMessage.emit(packet);
    if (packet.cmd === 'publish') {
      this.messages.next(packet);
    }
  };

  private handleOnPacketsend = (e: Packet) => {
    this._onPacketsend.emit(e);
  };

  private handleOnPacketreceive = (e: Packet) => {
    this._onPacketreceive.emit(e);
  };

  private generateClientId() {
    return 'client-' + Math.random().toString(36).substring(2, 19);
  }
}
