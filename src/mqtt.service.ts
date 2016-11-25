import { Injectable }                          from '@angular/core';
import { BehaviorSubject }                     from 'rxjs/BehaviorSubject';
import { Observable }                          from 'rxjs/Observable';
import { UsingObservable }                     from 'rxjs/observable/UsingObservable';
import { Subject }                             from 'rxjs/Subject';
import { Subscription, AnonymousSubscription } from 'rxjs/Subscription';
import * as MQTT                               from 'mqtt';
import {
  MqttServiceOptions,
  MqttConnectionState,
  MqttMessage
}                                              from './mqtt.model';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/share';

@Injectable()
export class MqttService {

  private client: MQTT.Client;
  private clientId: string = 'client-' + Math.random().toString(36).substr(2, 19);
  private protocolVersion: number = 4;
  private keepalive: number = 10;
  private connectTimeout: number = 10000;
  private reconnectPeriod: number = 10000;
  private url: string;

  public observables: { [filter: string]: Observable<MqttMessage> } = {};
  public state: BehaviorSubject<MqttConnectionState> = new BehaviorSubject(MqttConnectionState.CLOSED);
  public messages: Subject<MQTT.Packet> = new Subject<MQTT.Packet>();

  constructor(options: MqttServiceOptions) {
    const hostname = options.hostname || 'localhost';
    const port = options.port || 443;
    const protocol = options.protocol || 'ws';
    const path = options.path || 'mqtt';
    this.url = `${protocol}://${hostname}:${port}/{$path}`;
    this.client = MQTT.connect(this.url, {
      protocolVersion: this.protocolVersion,
      clientId: this.clientId,
      keepalive: this.keepalive,
      reconnectPeriod: this.reconnectPeriod,
      connectTimeout: this.connectTimeout
    });
    this.client.on('connect', this.onConnect);
    this.client.on('close', this.onClose);
    this.client.on('error', this.onError);
    this.client.on('reconnect', this.onReconnect);
    this.client.on('message', this.onMessage);

    this.state.subscribe();
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
        .share();
    }
    return this.observables[filter];
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

  private onClose = (e) => {
    this.state.next(MqttConnectionState.CLOSED);
  }

  private onConnect = (e) => {
    this.state.next(MqttConnectionState.CONNECTED);
  }

  private onReconnect = (e) => {
    this.state.next(MqttConnectionState.CONNECTING);
  }

  private onMessage = (topic, msg, packet) => {
    if (packet.cmd === 'publish') {
      this.messages.next(packet);
    }
  }

  private onError = (e) => {
    console.error(e);
  }
}
