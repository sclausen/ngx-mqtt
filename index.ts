import { NgModule, ModuleWithProviders } from '@angular/core';

import { MqttService }                   from './src/mqtt.service';
import { MqttServiceOptions }            from './src/mqtt.model';

export * from './src/mqtt.service';
export * from './src/mqtt.model';

export const MQTT_SERVICE_OPTIONS: MqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'localhost',
  port: 1884,
  path: ''
};

export function mqttServiceFactory() {
  return new MqttService(MQTT_SERVICE_OPTIONS);
}

@NgModule({})
export class MqttModule {
  static forRoot(providedService: any = {
    provide: MqttService,
    useFactory: mqttServiceFactory
  }): ModuleWithProviders {
    return {
      ngModule: MqttModule,
      providers: [providedService]
    };
  }
}