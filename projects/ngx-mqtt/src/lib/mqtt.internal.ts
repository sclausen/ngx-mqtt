export type MqttInternalEvent =
  | { type: 'subscribe'; filter: string }
  | { type: 'unsubscribe'; filter: string }
  | { type: 'publishError'; topic: string; error: Error };
