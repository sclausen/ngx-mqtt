import * as MQTT from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED
}

export interface MqttServiceOptions extends MQTT.IClientOptions {
  /** wether a new connection should be created
   *  on creating an instance of the service */
  connectOnCreate?: boolean;
  /** the hostname of the mqtt broker */
  hostname?: string;
  /** the port to connect with websocket to the broker */
  port?: number;
  /** the path parameters to connect to e.g. `/mqtt` */
  path?: string;
}

export interface MqttMessage extends MQTT.IPacket {
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

export interface PublishOptions extends MQTT.IClientPublishOptions { }
export interface OnConnectEvent extends MqttMessage { }
export interface OnErrorEvent extends Error { }
export interface OnMessageEvent extends MqttMessage { }