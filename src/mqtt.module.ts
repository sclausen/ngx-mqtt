import {
  NgModule,
  ModuleWithProviders,
  InjectionToken
} from '@angular/core';
import { MqttService } from './mqtt.service';
import { IMqttServiceOptions } from './mqtt.model';

export * from './mqtt.service';
export * from './mqtt.model';
import { MqttClient } from 'mqtt';

export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'localhost',
  port: 1884,
  path: ''
};

export const MqttServiceConfig = new InjectionToken<IMqttServiceOptions>('NgxMqttServiceConfig');
export const MqttClientService = new InjectionToken<MqttClient>('NgxMqttClientService');

@NgModule()
export class MqttModule {
  static forRoot(config: IMqttServiceOptions, client?: MqttClient): ModuleWithProviders {
    return {
      ngModule: MqttModule,
      providers: [
        {
          provide: MqttServiceConfig,
          useValue: config
        },
        {
          provide: MqttClientService,
          useValue: client
        }
      ]
    };
  }
}