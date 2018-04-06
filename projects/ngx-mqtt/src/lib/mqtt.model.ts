import { IClientOptions, IClientPublishOptions, IPacket } from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED
}

export interface MqttServiceOptions extends IClientOptions {
  /** wether a new connection should be created
   *  on creating an instance of the service */
  connectOnCreate?: boolean;
  /** the hostname of the mqtt broker */
  hostname?: string;
  /** the port to connect with websocket to the broker */
  port?: number;
  /** the path parameters to connect to e.g. `/mqtt` */
  path?: string;
  protocol?: 'wss' | 'ws';
}

export interface MqttMessage extends IPacket {
  /** the mqtt topic to which this message was published to */
  topic: string;
  /** the payload */
  payload: Uint8Array;
  /** the quality of service */
  qos: number;
  /** if this message is a retained message */
  retain: boolean;
  /** if this message is a dublicate */
  dup: boolean;
}

// tslint:disable-next-line:no-empty-interface
export interface PublishOptions extends IClientPublishOptions { }
// tslint:disable-next-line:no-empty-interface
export interface OnConnectEvent extends MqttMessage { }
// tslint:disable-next-line:no-empty-interface
export interface OnErrorEvent extends Error { }
// tslint:disable-next-line:no-empty-interface
export interface OnMessageEvent extends MqttMessage { }
export interface OnSubackEvent {
  granted: boolean;
  filter: string;
}
