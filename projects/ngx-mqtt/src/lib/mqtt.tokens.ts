import { InjectionToken } from '@angular/core';
import type { MqttClient } from 'mqtt';
import type { MqttServiceOptions } from './mqtt.model';

export const MqttServiceConfig = new InjectionToken<MqttServiceOptions>('NgxMqttServiceConfig');
export const MqttClientService = new InjectionToken<MqttClient | undefined>('NgxMqttClientService');
