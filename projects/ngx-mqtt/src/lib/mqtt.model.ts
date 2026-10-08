import type {
  IClientOptions,
  IClientPublishOptions,
  IConnackPacket,
  IPublishPacket,
  MqttClient,
  Packet,
} from 'mqtt';

export type { IClientPublishOptions, IClientSubscribeOptions, Packet } from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED,
}

export type MqttLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface MqttLogEntry {
  level: Exclude<MqttLogLevel, 'silent'>;
  message: string;
  event: string;
  clientId: string;
  timestamp: string;
  context?: { filter?: string; topic?: string; cmd?: string; reasonCode?: number };
}

export type MqttLogger = (entry: MqttLogEntry) => void;

export interface MqttServiceOptions extends IClientOptions {
  connectOnCreate?: boolean;
  hostname?: string;
  port?: number;
  path?: string;
  protocol?: 'wss' | 'ws';
  url?: string;
  logLevel?: MqttLogLevel;
  logger?: MqttLogger;
}

/** @deprecated Use MqttServiceOptions. */
export type IMqttServiceOptions = MqttServiceOptions;

export type MqttPayload = Parameters<MqttClient['publish']>[1];

export interface IMqttMessage extends Omit<IPublishPacket, 'payload'> {
  payload: Uint8Array;
}

export type IPublishOptions = IClientPublishOptions;
export type IOnConnectEvent = IConnackPacket;
export interface IOnErrorEvent extends Error {
  type?: string;
  code?: number;
}
export type IOnMessageEvent = IMqttMessage;
export interface IOnSubackEvent {
  granted: boolean;
  filter: string;
}
export type IOnPacketsendEvent = Packet;
export type IOnPacketreceiveEvent = Packet;
export type IMqttClient = MqttClient;
