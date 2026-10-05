import type {
  IClientPublishOptions,
  IClientSubscribeOptions,
  IPublishPacket,
  ISubscriptionGrant,
  MqttClient,
} from 'mqtt';

type Listener = (...args: unknown[]) => void;

class Emitter {
  private readonly listeners = new Map<string, Listener[]>();

  on(event: string, listener: (...args: never[]) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener as Listener]);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export class FakeMqttClient extends Emitter {
  readonly stream = new Emitter();
  readonly subscribeCalls: { filter: string; opts: IClientSubscribeOptions }[] = [];
  readonly unsubscribeCalls: string[] = [];
  readonly publishCalls: { topic: string; message: unknown; opts: IClientPublishOptions }[] = [];
  readonly endCalls: boolean[] = [];
  grantedQos: ISubscriptionGrant['qos'] = 1;
  publishError: Error | undefined;
  subackReasonCode: number | undefined;
  subscribeError: Error | undefined;

  subscribe(
    filter: string,
    opts: IClientSubscribeOptions,
    callback?: (
      error: Error | null,
      granted?: ISubscriptionGrant[],
      packet?: { cmd: 'suback'; granted: number[] },
    ) => void,
  ): this {
    this.subscribeCalls.push({ filter, opts });
    queueMicrotask(() => {
      if (this.subscribeError) {
        callback?.(this.subscribeError, undefined, undefined);
        return;
      }
      const code = this.subackReasonCode;
      if (code !== undefined && (code & 0x80) !== 0) {
        const packet = { cmd: 'suback' as const, granted: [code] };
        const error = Object.assign(new Error('Subscribe error'), { code, packet });
        callback?.(
          error,
          [{ topic: filter, qos: (opts.qos ?? 0) as ISubscriptionGrant['qos'] }],
          packet,
        );
        return;
      }
      callback?.(null, [{ topic: filter, qos: this.grantedQos }], {
        cmd: 'suback',
        granted: [this.grantedQos],
      });
    });
    return this;
  }

  unsubscribe(filter: string): this {
    this.unsubscribeCalls.push(filter);
    return this;
  }

  publish(
    topic: string,
    message: unknown,
    opts: IClientPublishOptions,
    callback?: (error?: Error) => void,
  ): this {
    this.publishCalls.push({ topic, message, opts });
    queueMicrotask(() => callback?.(this.publishError));
    return this;
  }

  end(force?: boolean): this {
    this.endCalls.push(force === true);
    return this;
  }

  deliver(topic: string, payload: string, extra: Partial<IPublishPacket> = {}): void {
    const packet = {
      cmd: 'publish',
      topic,
      payload: new TextEncoder().encode(payload),
      qos: 0,
      retain: false,
      dup: false,
      ...extra,
    };
    this.emit('message', topic, packet.payload, packet);
  }

  asClient(): MqttClient {
    return this as unknown as MqttClient;
  }
}
