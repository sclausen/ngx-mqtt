import { EventEmitter, Inject, Injectable } from '@angular/core';
import { ISubscriptionGrant } from './mqtt-types';
import { connect } from '../vendor/mqtt.browserified.js';
import * as extend from 'xtend';

import { BehaviorSubject, merge, Observable, Observer, Subscription, Subject, Unsubscribable, using } from 'rxjs';
import { filter, publish, refCount } from 'rxjs/operators';

import {
  IMqttClient,
  MqttConnectionState,
  IMqttMessage,
  IMqttServiceOptions,
  IOnConnectEvent,
  IOnErrorEvent,
  IOnMessageEvent,
  IOnSubackEvent,
  IPublishOptions
} from './mqtt.model';

import { MqttModule, MqttServiceConfig, MqttClientService } from './index';

/**
 * With an instance of MqttService, you can observe and subscribe to MQTT in multiple places, e.g. in different components,
 * to only subscribe to the broker once per MQTT filter.
 * It also handles proper unsubscription from the broker, if the last observable with a filter is closed.
 */
@Injectable({
  providedIn: 'root',
})
export class MqttService {
  /** a map of all mqtt observables by filter */
  public observables: { [filter: string]: Observable<IMqttMessage> } = {};
  /** the connection state */
  public state: BehaviorSubject<MqttConnectionState> = new BehaviorSubject(MqttConnectionState.CLOSED);
  /** an observable of the last mqtt message */
  public messages: Subject<IMqttMessage> = new Subject<IMqttMessage>();

  private _clientId = this._generateClientId();
  private _keepalive = 10;
  private _connectTimeout = 10000;
  private _reconnectPeriod = 10000;
  private _url: string | undefined = undefined;

  private _onConnect: EventEmitter<IOnConnectEvent> = new EventEmitter<IOnConnectEvent>();
  private _onClose: EventEmitter<void> = new EventEmitter<void>();
  private _onError: EventEmitter<IOnErrorEvent> = new EventEmitter<IOnErrorEvent>();
  private _onReconnect: EventEmitter<void> = new EventEmitter<void>();
  private _onMessage: EventEmitter<IOnMessageEvent> = new EventEmitter<IOnMessageEvent>();
  private _onSuback: EventEmitter<IOnSubackEvent> = new EventEmitter<IOnSubackEvent>();

  /**
   * The constructor needs [connection options]{@link IMqttServiceOptions} regarding the broker and some
   * options to configure behavior of this service, like if the connection to the broker
   * should be established on creation of this service or not.
   * @param options connection and creation options for MQTT.js and this service
   * @param client an instance of IMqttClient
   */
  constructor(
    @Inject(MqttServiceConfig) private options: IMqttServiceOptions,
    @Inject(MqttClientService) private client?: IMqttClient
  ) {
    if (options.connectOnCreate !== false) {
      this.connect({}, client);
    }

    this.state.subscribe();
  }

  /**
   * connect manually connects to the mqtt broker.
   * @param opts the connection options
   * @param client an optional IMqttClient
   */
  public connect(opts?: IMqttServiceOptions, client?: IMqttClient) {
    const options = extend(this.options || {}, opts);
    const protocol = options.protocol || 'ws';
    const hostname = options.hostname || 'localhost';
    const port = options.port || 1884;
    const path = options.path || '/';
    this._url = `${protocol}://${hostname}:${port}/${path}`;
    this.state.next(MqttConnectionState.CONNECTING);
    const mergedOptions = extend({
      clientId: this._clientId,
      keepalive: this._keepalive,
      reconnectPeriod: this._reconnectPeriod,
      connectTimeout: this._connectTimeout
    }, options);

    if (this.client) {
      this.client.end(true);
    }

    if (!client) {
      this.client = <IMqttClient>connect(this._url, mergedOptions);
    } else {
      this.client = client;
    }
    this._clientId = mergedOptions.clientId;

    this.client.on('connect', this._handleOnConnect);
    this.client.on('close', this._handleOnClose);
    this.client.on('error', this._handleOnError);
    this.client.stream.on('error', this._handleOnError);
    this.client.on('reconnect', this._handleOnReconnect);
    this.client.on('message', this._handleOnMessage);
  }

  /**
   * gets the _clientId
   */
  public get clientId() {
    return this._clientId;
  }

  /**
   * disconnect disconnects from the mqtt client.
   * This method `should` be executed when leaving the application.
   */
  public disconnect(force = true) {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    this.client.end(force);
  }

  /**
   * With this method, you can observe messages for a mqtt topic.
   * The observable will only emit messages matching the filter.
   * The first one subscribing to the resulting observable executes a mqtt subscribe.
   * The last one unsubscribing this filter executes a mqtt unsubscribe.
   * @param  {string}                  filter
   * @return {Observable<IMqttMessage>}        the observable you can subscribe to
   */
  public observe(filterString: string): Observable<IMqttMessage> {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    if (!this.observables[filterString]) {
      const rejected: Subject<IMqttMessage> = new Subject();
      this.observables[filterString] = using(
          // resourceFactory: Do the actual ref-counting MQTT subscription.
          // refcount is decreased on unsubscribe.
          () => {
            const subscription: Subscription = new Subscription();
            this.client.subscribe(filterString, (err, granted: ISubscriptionGrant[]) => {
              if (granted) { // granted can be undefined when an error occurs when the client is disconnecting
                granted.forEach((granted_: ISubscriptionGrant) => {
                  if (granted_.qos === 128) {
                    delete this.observables[granted_.topic];
                    this.client.unsubscribe(granted_.topic);
                    rejected.error(`subscription for '${granted_.topic}' rejected!`);
                  }
                  this._onSuback.emit({filter: filterString, granted: granted_.qos !== 128});
                });
              }
            });
            subscription.add(() => {
              delete this.observables[filterString];
              this.client.unsubscribe(filterString);
            });
            return subscription;
          },
          // observableFactory: Create the observable that is consumed from.
          // This part is not executed until the Observable returned by
          // `observe` gets actually subscribed.
          (subscription: Unsubscribable | void) => merge(rejected, this.messages))
        .pipe(
          filter((msg: IMqttMessage) => MqttService.filterMatchesTopic(filterString, msg.topic)),
          publish(),
          refCount()
        ) as Observable<IMqttMessage>;
    }
    return this.observables[filterString];
  }

  /**
   * This method publishes a message for a topic with optional options.
   * The returned observable will complete, if publishing was successful
   * and will throw an error, if the publication fails
   * @param  {string}           topic
   * @param  {any}              message
   * @param  {PublishOptions}   options
   * @return {Observable<void>}
   */
  public publish(topic: string, message: any, options?: IPublishOptions): Observable<void> {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    const source = Observable.create((obs: Observer<void>) => {
      this.client.publish(topic, message, options, (err: Error) => {
        if (err) {
          obs.error(err);
        } else {
          obs.complete();
        }
      });
    });
    return source;
  }

  /**
   * This method publishes a message for a topic with optional options.
   * If an error occurs, it will throw.
   * @param  {string}           topic
   * @param  {any}              message
   * @param  {PublishOptions}   options
   */
  public unsafePublish(topic: string, message: any, options?: IPublishOptions): void {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    this.client.publish(topic, message, options, (err: Error) => {
      if (err) {
        throw (err);
      }
    });
  }

  /**
   * This static method shall be used to determine whether a MQTT
   * topic matches a given filter. The matching rules are specified in the MQTT
   * standard documentation and in the library test suite.
   *
   * @param  {string}  filter A filter may contain wildcards like '#' and '+'.
   * @param  {string}  topic  A topic may not contain wildcards.
   * @return {boolean}        true on match and false otherwise.
   */
  public static filterMatchesTopic(filter: string, topic: string): boolean {
    if (filter[0] === '#' && topic[0] === '$') {
      return false;
    }
    // Preparation: split and reverse on '/'. The JavaScript split function is sane.
    const fs = (filter || '').split('/').reverse();
    const ts = (topic || '').split('/').reverse();
    // This function is tail recursive and compares both arrays one element at a time.
    const match = (): boolean => {
      // Cutting of the last element of both the filter and the topic using pop().
      const f = fs.pop();
      const t = ts.pop();
      switch (f) {
        // In case the filter level is '#', this is a match no matter whether
        // the topic is undefined on this level or not ('#' matches parent element as well!).
        case '#': return true;
        // In case the filter level is '+', we shall dive into the recursion only if t is not undefined.
        case '+': return t ? match() : false;
        // In all other cases the filter level must match the topic level,
        // both must be defined and the filter tail must match the topic
        // tail (which is determined by the recursive call of match()).
        default: return f === t && (f === undefined ? true : match());
      }
    };
    return match();
  }


  /** An EventEmitter to listen to close messages */
  public get onClose(): EventEmitter<void> {
    return this._onClose;
  }

  /** An EventEmitter to listen to connect messages */
  public get onConnect(): EventEmitter<IOnConnectEvent> {
    return this._onConnect;
  }

  /** An EventEmitter to listen to reconnect messages */
  public get onReconnect(): EventEmitter<void> {
    return this._onReconnect;
  }

  /** An EventEmitter to listen to message events */
  public get onMessage(): EventEmitter<IOnMessageEvent> {
    return this._onMessage;
  }

  /** An EventEmitter to listen to suback events */
  public get onSuback(): EventEmitter<IOnSubackEvent> {
    return this._onSuback;
  }

  /** An EventEmitter to listen to error events */
  public get onError(): EventEmitter<IOnErrorEvent> {
    return this._onError;
  }

  private _handleOnClose = () => {
    this.state.next(MqttConnectionState.CLOSED);
    this._onClose.emit();
  }

  private _handleOnConnect = (e: IOnConnectEvent) => {
    Object.keys(this.observables).forEach((filter: string) => {
      this.client.subscribe(filter);
    });
    this.state.next(MqttConnectionState.CONNECTED);
    this._onConnect.emit(e);
  }

  private _handleOnReconnect = () => {
    Object.keys(this.observables).forEach((filter: string) => {
      this.client.subscribe(filter);
    });
    this.state.next(MqttConnectionState.CONNECTING);
    this._onReconnect.emit();
  }

  private _handleOnError = (e: IOnErrorEvent) => {
    this._onError.emit(e);
    console.error(e);
  }

  private _handleOnMessage = (topic, msg, packet) => {
    this._onMessage.emit(packet);
    if (packet.cmd === 'publish') {
      this.messages.next(packet);
    }
  }

  private _generateClientId() {
    return 'client-' + Math.random().toString(36).substr(2, 19);
  }
}
