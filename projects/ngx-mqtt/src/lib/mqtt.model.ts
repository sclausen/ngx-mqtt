import { IClientOptions, IClientPublishOptions } from 'mqtt';

export enum MqttConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTED,
}

export interface IMqttServiceOptions extends IClientOptions {
  /**
   * whether a new connection should be created
   * on creating an instance of the service
   */
  connectOnCreate?: boolean;
  /** the hostname of the mqtt broker */
  hostname?: string;
  /** the port to connect with websocket to the broker */
  port?: number;
  /** the path parameters to connect to e.g. `/mqtt` */
  path?: string;
  protocol?: 'wss' | 'ws';
  /** if the url is provided, hostname, port path and protocol are ignored */
  url?: string;
}
