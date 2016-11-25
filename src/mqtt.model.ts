import { Packet } from 'mqtt';

export interface MqttServiceOptions {
  hostname?: string;
  port?: number;
  protocol?: string;
  path?: string;
}

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED
}

export interface MqttMessage extends Packet {
  topic: string;
  payload: Uint8Array;
  qos: number;
  retain: boolean;
  dup: boolean;
}