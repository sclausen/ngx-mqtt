import { Packet, ClientPublishOptions, ClientOptions } from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED
}

export interface MqttServiceOptions extends ClientOptions {
  /** wether a new connection should be created
   *  on creating an instance of the service */
  connectOnCreate?: boolean;
  /** the hostname of the mqtt broker */
  hostname?: string;
  /** the port to connect with websocket to the broker */
  port?: number;
  /** which protocol should be used. ws and wss are supported */
  protocol?: string;
  /** the path parameters to connect to e.g. `/mqtt` */
  path?: string;
}

export interface MqttMessage extends Packet {
  /** one of the many mqtt commands
   *  see [mqtt-packet]{@link https://github.com/mqttjs/mqtt-packet} for more information */
  cmd: string;
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

export interface PublishOptions extends ClientPublishOptions { }
export interface OnConnectEvent extends MqttMessage { }
export interface OnErrorEvent extends Error { }
export interface OnMessageEvent extends MqttMessage { }