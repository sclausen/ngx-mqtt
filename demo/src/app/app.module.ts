import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { KeysPipe, StateToStringPipe, StateToClassPipe } from './pipes';
import { FormsModule } from '@angular/forms';

import {
  MqttMessage,
  MqttModule,
  MqttService,
  MqttServiceOptions,
  OnMessageEvent
} from 'ngx-mqtt';

export const MQTT_SERVICE_OPTIONS: MqttServiceOptions = {
  hostname: 'localhost',
  port: 9001
};

export function mqttServiceFactory() {
  return new MqttService(MQTT_SERVICE_OPTIONS);
}

@NgModule({
  imports: [
    FormsModule,
    BrowserModule,
    MqttModule.forRoot({
      provide: MqttService,
      useFactory: mqttServiceFactory
    })
  ],
  declarations: [
    AppComponent,
    KeysPipe,
    StateToStringPipe,
    StateToClassPipe
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
