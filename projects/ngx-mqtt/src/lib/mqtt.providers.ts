import {
  type EnvironmentProviders,
  makeEnvironmentProviders,
  type ModuleWithProviders,
  NgModule,
} from '@angular/core';
import type { MqttClient } from 'mqtt';
import type { MqttServiceOptions } from './mqtt.model';
import { MqttClientService, MqttServiceConfig } from './mqtt.tokens';

export function provideMqtt(
  options: MqttServiceOptions,
  client?: MqttClient,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MqttServiceConfig, useValue: options },
    { provide: MqttClientService, useValue: client },
  ]);
}

/** @deprecated Use provideMqtt. MqttModule will be removed in the next major version. */
@NgModule()
export class MqttModule {
  /** @deprecated Use provideMqtt. */
  static forRoot(
    options: MqttServiceOptions,
    client?: MqttClient,
  ): ModuleWithProviders<MqttModule> {
    return { ngModule: MqttModule, providers: [provideMqtt(options, client)] };
  }
}
