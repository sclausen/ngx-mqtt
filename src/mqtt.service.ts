import { Injectable, EventEmitter } from '@angular/core';
import * as MQTT from 'mqtt';
import * as extend from 'xtend';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { UsingObservable } from 'rxjs/observable/UsingObservable';
import { Subject } from 'rxjs/Subject';
import { Subscription, AnonymousSubscription } from 'rxjs/Subscription';
import 'rxjs/add/observable/merge';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/publishReplay';

import {
  MqttConnectionState,
  MqttMessage,
  MqttServiceOptions,
  OnConnectEvent,
  OnErrorEvent,
  OnMessageEvent,
  PublishOptions
} from './mqtt.model';

/**
 * With an instance of MqttService, you can observe and subscribe to MQTT in multiple places, e.g. in different components,
 * to only subscribe to the broker once per MQTT filter.
 * It also handles proper unsubscription from the broker, if the last observable with a filter is closed.
 */
@Injectable()
export class MqttService {
  /** a map of all mqtt observables by filter */
  public observables: { [filter: string]: Observable<MqttMessage> } = {};
  /** the connection state */
  public state: BehaviorSubject<MqttConnectionState> = new BehaviorSubject(MqttConnectionState.CLOSED);
  /** an observable of the last mqtt message */
  public messages: Subject<MQTT.IPacket> = new Subject<MQTT.IPacket>();

  private clientId = this._generateClientId();
  private keepalive = 10;
  private connectTimeout = 10000;
  private reconnectPeriod = 10000;
  private url: string;

  private _onConnect: EventEmitter<OnConnectEvent> = new EventEmitter<OnConnectEvent>();
  private _onClose: EventEmitter<void> = new EventEmitter<void>();
  private _onError: EventEmitter<OnErrorEvent> = new EventEmitter<OnErrorEvent>();
  private _onReconnect: EventEmitter<void> = new EventEmitter<void>();
  private _onMessage: EventEmitter<OnMessageEvent> = new EventEmitter<OnMessageEvent>();

  /**
   * The constructor needs [connection options]{@link MqttServiceOptions} regarding the broker and some
   * options to configure behavior of this service, like if the connection to the broker
   * should be established on creation of this service or not.
   * @param options connection and creation options for MQTT.js and this service
   * @param client a already created MQTT.Client
   */
  constructor(private options: MqttServiceOptions, private client?: MQTT.Client) {
    if (options.connectOnCreate !== false) {
      this.connect({}, client);
    }

    this.state.subscribe();
  }

  /**
   * connect manually connects to the mqtt broker.
   * @param opts the connection options
   * @param client an optional MQTT.Client
   */
  public connect(opts?: MqttServiceOptions, client?: MQTT.Client) {
    const options = extend(this.options || {}, opts);
    const protocol = options.protocol || 'ws';
    const hostname = options.hostname || 'localhost';
    const port = options.port || 1884;
    const path = options.path || '/';
    this.url = `${protocol}://${hostname}:${port}/${path}`;
    this.state.next(MqttConnectionState.CONNECTING);
    if (!client) {
      this.client = MQTT.connect(this.url, extend({
        clientId: this.clientId,
        keepalive: this.keepalive,
        reconnectPeriod: this.reconnectPeriod,
        connectTimeout: this.connectTimeout
      }, options));
    } else {
      this.client = client;
    }

    this.client.on('connect', this._handleOnConnect);
    this.client.on('close', this._handleOnClose);
    this.client.on('error', this._handleOnError);
    this.client.on('reconnect', this._handleOnReconnect);
    this.client.on('message', this._handleOnMessage);
  }

  /** disconnect disconnects from the mqtt client.
   *  This method `should` be executed when leaving the application.
   */
  public disconnect() {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    this.client.end();
  }

  /**
   * With this method, you can observe messages for a mqtt topic.
   * The observable will only emit messages matching the filter.
   * The first one subscribing to the resulting observable executes a mqtt subscribe.
   * The last one unsubscribing this filter executes a mqtt unsubscribe.
   * @param  {string}                  filter
   * @return {Observable<MqttMessage>}        the observable you can subscribe to
   */
  public observe(filter: string): Observable<MqttMessage> {
    if (!this.client) {
      throw new Error('mqtt client not connected');
    }
    if (!this.observables[filter]) {
      const rejected = new Subject();
      this.observables[filter] = UsingObservable
        .create(
        // resourceFactory: Do the actual ref-counting MQTT subscription.
        // refcount is decreased on unsubscribe.
        () => {
          const subscription: Subscription = new Subscription();
          this.client.subscribe(filter, (err, granted: MQTT.ISubscriptionGrant[]) => {
            granted.forEach((granted_: MQTT.ISubscriptionGrant) => {
              if (granted_.qos === 128) {
                delete this.observables[granted_.topic];
                this.client.unsubscribe(granted_.topic);
                rejected.error(`subscription for '${granted_.topic}' rejected!`);
              };
            });
          });
          subscription.add(() => {
            delete this.observables[filter];
            this.client.unsubscribe(filter);
          });
          return subscription;
        },
        // observableFactory: Create the observable that is consumed from.
        // This part is not executed until the Observable returned by
        // `observe` gets actually subscribed.
        (subscription: AnonymousSubscription) => Observable.merge(rejected, this.messages))
        .filter((msg: MqttMessage) => MqttService.filterMatchesTopic(filter, msg.topic))
        .publishReplay(1)
        .refCount();
    }
    return this.observables[filter];
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
  public publish(topic: string, message: any, options?: PublishOptions): Observable<void> {
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
  public unsafePublish(topic: string, message: any, options?: PublishOptions): void {
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
   * This static method shall be used to determine whether an MQTT
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
        // In case the filter level is '#', this is a match not matter whether
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
  public get onConnect(): EventEmitter<OnConnectEvent> {
    return this._onConnect;
  }

  /** An EventEmitter to listen to reconnect messages */
  public get onReconnect(): EventEmitter<void> {
    return this._onReconnect;
  }

  /** An EventEmitter to listen to message events */
  public get onMessage(): EventEmitter<OnMessageEvent> {
    return this._onMessage;
  }

  /** An EventEmitter to listen to error events */
  public get onError(): EventEmitter<OnErrorEvent> {
    return this._onError;
  }

  private _handleOnClose = () => {
    this.state.next(MqttConnectionState.CLOSED);
    this._onClose.emit();
  }

  private _handleOnConnect = (e: OnConnectEvent) => {
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

  private _handleOnError = (e: OnErrorEvent) => {
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
