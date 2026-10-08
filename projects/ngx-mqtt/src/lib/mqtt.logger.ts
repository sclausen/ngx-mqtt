import type { Packet } from 'mqtt';
import { filter, type Observable, Subscription } from 'rxjs';
import type { MqttInternalEvent } from './mqtt.internal';
import type {
  IOnErrorEvent,
  IOnSubackEvent,
  MqttLogEntry,
  MqttLogger,
  MqttLogLevel,
  MqttServiceOptions,
} from './mqtt.model';

export interface MqttEventSource {
  readonly onConnect: Observable<unknown>;
  readonly onReconnect: Observable<void>;
  readonly onClose: Observable<void>;
  readonly onOffline: Observable<void>;
  readonly onError: Observable<IOnErrorEvent>;
  readonly onEnd: Observable<void>;
  readonly onSuback: Observable<IOnSubackEvent>;
  readonly onPacketsend: Observable<Packet>;
  readonly onPacketreceive: Observable<Packet>;
}

type LoggedLevel = MqttLogEntry['level'];
type EntryBody = Pick<MqttLogEntry, 'event' | 'message' | 'context'>;

const LEVEL_ORDER: Record<MqttLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export const consoleLogger: MqttLogger = (entry) =>
  console[entry.level]('[ngx-mqtt]', entry.message, entry);

export function redact(text: string): string {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/?#]*@/gi, '$1');
}

function packetContext(packet: Packet): MqttLogEntry['context'] {
  const topic = 'topic' in packet && typeof packet.topic === 'string' ? packet.topic : undefined;
  return topic === undefined ? { cmd: packet.cmd } : { cmd: packet.cmd, topic };
}

function errorContext(error: IOnErrorEvent): MqttLogEntry['context'] | undefined {
  return typeof error.code === 'number' ? { reasonCode: error.code } : undefined;
}

function ofType<T extends MqttInternalEvent['type']>(type: T) {
  return (event: MqttInternalEvent): event is Extract<MqttInternalEvent, { type: T }> =>
    event.type === type;
}

export function startLogging(
  source: MqttEventSource,
  internal: Observable<MqttInternalEvent>,
  options: Pick<MqttServiceOptions, 'logLevel' | 'logger'>,
  clientId: () => string,
): Subscription {
  const subscription = new Subscription();
  const threshold = LEVEL_ORDER[options.logLevel ?? 'error'];
  const sink = options.logger ?? consoleLogger;

  const on = <T>(level: LoggedLevel, stream: Observable<T>, describe: (value: T) => EntryBody) => {
    if (LEVEL_ORDER[level] < threshold) {
      return;
    }
    subscription.add(
      stream.subscribe((value) => {
        const body = describe(value);
        sink({
          level,
          event: body.event,
          message: body.message,
          clientId: clientId(),
          timestamp: new Date().toISOString(),
          ...(body.context ? { context: body.context } : {}),
        });
      }),
    );
  };

  on('error', source.onError, (error) => ({
    event: 'error',
    message: redact(error.message ?? String(error)),
    context: errorContext(error),
  }));
  on('warn', source.onOffline, () => ({ event: 'offline', message: 'client went offline' }));
  on('warn', source.onSuback.pipe(filter((suback) => !suback.granted)), (suback) => ({
    event: 'subscriptionRejected',
    message: `subscription for '${suback.filter}' rejected`,
    context: { filter: suback.filter },
  }));
  on('warn', internal.pipe(filter(ofType('publishError'))), (event) => ({
    event: 'publishFailed',
    message: `publish to '${event.topic}' failed: ${redact(event.error.message)}`,
    context: { topic: event.topic },
  }));
  on('info', source.onConnect, () => ({ event: 'connect', message: 'connected' }));
  on('info', source.onReconnect, () => ({ event: 'reconnect', message: 'reconnecting' }));
  on('info', source.onClose, () => ({ event: 'close', message: 'connection closed' }));
  on('info', source.onEnd, () => ({ event: 'end', message: 'client ended' }));
  on('debug', internal.pipe(filter(ofType('subscribe'))), (event) => ({
    event: 'subscribe',
    message: `subscribing to '${event.filter}'`,
    context: { filter: event.filter },
  }));
  on('debug', internal.pipe(filter(ofType('unsubscribe'))), (event) => ({
    event: 'unsubscribe',
    message: `unsubscribing from '${event.filter}'`,
    context: { filter: event.filter },
  }));
  on('debug', source.onPacketsend, (packet) => ({
    event: 'packetsend',
    message: `sent ${packet.cmd}`,
    context: packetContext(packet),
  }));
  on('debug', source.onPacketreceive, (packet) => ({
    event: 'packetreceive',
    message: `received ${packet.cmd}`,
    context: packetContext(packet),
  }));

  return subscription;
}
