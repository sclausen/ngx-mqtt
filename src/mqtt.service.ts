import { Injectable, EventEmitter } from '@angular/core';
import * as MQTT from 'mqtt';
import * as extend from 'xtend';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { UsingObservable } from 'rxjs/observable/UsingObservable';
import { Subject } from 'rxjs/Subject';
import { Subscription, AnonymousSubscription } from 'rxjs/Subscription';
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

@Injectable()
export class MqttService {
  public observables: { [filter: string]: Observable<MqttMessage> } = {};
  public state: BehaviorSubject<MqttConnectionState> = new BehaviorSubject(MqttConnectionState.CLOSED);
  public messages: Subject<MQTT.Packet> = new Subject<MQTT.Packet>();

  private client: MQTT.Client;
  private clientId = 'client-' + Math.random().toString(36).substr(2, 19);
  private keepalive = 10;
  private connectTimeout = 10000;
  private reconnectPeriod = 10000;
  private url: string;

  public _onConnect: EventEmitter<OnConnectEvent> = new EventEmitter<OnConnectEvent>();
  public _onClose: EventEmitter<void> = new EventEmitter<void>();
  public _onError: EventEmitter<OnErrorEvent> = new EventEmitter<OnErrorEvent>();
  public _onReconnect: EventEmitter<void> = new EventEmitter<void>();
  public _onMessage: EventEmitter<OnMessageEvent> = new EventEmitter<OnMessageEvent>();

  constructor(private options: MqttServiceOptions) {
    if (options.connectOnCreate === true) {
      this.connect();
    }

    this.state.subscribe();
  }

  public connect(opts?: MqttServiceOptions) {
    const options = extend(this.options || {}, opts);
    const protocol = options.protocol || 'ws';
    const hostname = options.hostname || 'localhost';
    const port = options.port || 1884;
    const path = options.path || '/';
    this.url = `${protocol}://${hostname}:${port}/${path}`;

    this.client = MQTT.connect(this.url, extend({
      clientId: this.clientId,
      keepalive: this.keepalive,
      reconnectPeriod: this.reconnectPeriod,
      connectTimeout: this.connectTimeout
    }, options));

    this.client.on('connect', this.handleOnConnect);
    this.client.on('close', this.handleOnClose);
    this.client.on('error', this.handleOnError);
    this.client.on('reconnect', this.handleOnReconnect);
    this.client.on('message', this.handleOnMessage);
  }

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

      this.observables[filter] = UsingObservable
        .create(
        // resourceFactory: Do the actual ref-counting MQTT subscription.
        // refcount is decreased on unsubscribe.
        () => {
          const subscription: Subscription = new Subscription();
          this.client.subscribe(filter);
          subscription.add(() => {
            delete this.observables[filter];
            this.client.unsubscribe(filter);
          });
          return subscription;
        },
        // observableFactory: Create the observable that is consumed from.
        // This part is not executed until the Observable returned by
        // `observe` gets actually subscribed.
        (subscription: AnonymousSubscription) => this.messages)
        .filter((msg: MqttMessage) => MqttService.filterMatchesTopic(filter, msg.topic))
        .publishReplay(1)
        .refCount();
    }
    return this.observables[filter];
  }

  /**
   * This method publishes a message for a topic with optional options.
   * The returned observable will complete, if publishing was successfull
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
   * standard documenation and in the library test suite.
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
    // This function is tail recursive and compoares both arrays one element at a time.
    const match = (): boolean => {
      // Cutting of the last element of both the filter and the topic using pop().
      const f = fs.pop();
      const t = ts.pop();
      switch (f) {
        // In case the filter level is '#', this is a match not matter whether
        // the topic is undefined on this level or not ('#'' matches parent element as well!).
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

  private handleOnClose = () => {
    this.state.next(MqttConnectionState.CLOSED);
    this._onClose.emit();
  }

  private handleOnConnect = (e: OnConnectEvent) => {
    this.state.next(MqttConnectionState.CONNECTED);
    this._onConnect.emit(e);
  }

  private handleOnReconnect = () => {
    this.state.next(MqttConnectionState.CONNECTING);
    this._onReconnect.emit();
  }

  private handleOnError = (e: OnErrorEvent) => {
    this._onError.emit(e);
    console.error(e);
  }

  private handleOnMessage = (topic, msg, packet) => {
    this._onMessage.emit(packet);
    if (packet.cmd === 'publish') {
      this.messages.next(packet);
    }
  }


  /**
   * An EventEmitter to listen to close messages
   * onClose.subscribe(() => {
   *     // do something
   * });
   * @type {EventEmitter<void>}
   */
  public get onClose(): EventEmitter<void> {
    return this._onClose;
  }

  /**
   * An EventEmitter to listen to connect messages
   * onConnect.subscribe((message: MqttMessage) => {
   *     // do something
   * });
   * @type {EventEmitter<OnConnectEvent>}
   */
  public get onConnect(): EventEmitter<OnConnectEvent> {
    return this._onConnect;
  }

  /**
   * An EventEmitter to listen to reconnect messages
   * onReconnect.subscribe(() => {
   *     // do something
   * });
   * @type {EventEmitter<void>}
   */
  public get onReconnect(): EventEmitter<void> {
    return this._onReconnect;
  }

  /**
   * An EventEmitter to listen to message events
   * onMessage.subscribe((e: OnMessageEvent) => {
   *     // do something
   * });
   * @type {EventEmitter<OnMessageEvent>}
   */
  public get onMessage(): EventEmitter<OnMessageEvent> {
    return this._onMessage;
  }

  /**
   * An EventEmitter to listen to error events
   * onError.subscribe((e: OnErrorEvent) => {
   *     // do something
   * });
   * @type {EventEmitter<OnErrorEvent>}
   */
  public get onError(): EventEmitter<OnErrorEvent> {
    return this._onError;
  }
}
