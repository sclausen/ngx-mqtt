import {
  NgModule,
  ModuleWithProviders,
  InjectionToken
} from '@angular/core';
import { IMqttClient, IMqttServiceOptions } from './mqtt.model';

export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'localhost',
  port: 1884,
  path: ''
};

export const MqttServiceConfig = new InjectionToken<IMqttServiceOptions>('NgxMqttServiceConfig');
export const MqttClientService = new InjectionToken<IMqttClient>('NgxMqttClientService');

@NgModule()
export class MqttModule {
  static forRoot(config: IMqttServiceOptions, client?: IMqttClient): ModuleWithProviders<MqttModule> {
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
