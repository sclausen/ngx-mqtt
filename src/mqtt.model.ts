import { Packet, ClientPublishOptions, ClientOptions } from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED
}

export interface MqttServiceOptions extends ClientOptions {
  connectOnCreate?: boolean;
  hostname?: string;
  port?: number;
  protocol?: string;
  path?: string;
}

export interface MqttMessage extends Packet {
  cmd: string;
  topic: string;
  payload: Uint8Array;
  qos: number;
  retain: boolean;
  dup: boolean;
}

export interface PublishOptions extends ClientPublishOptions {

}

export interface OnConnectEvent extends MqttMessage { }
export interface OnErrorEvent extends Error { }
export interface OnMessageEvent extends MqttMessage { }