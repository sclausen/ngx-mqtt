import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MqttModule } from 'ngx-mqtt';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    MqttModule.forRoot({
      connectOnCreate: true,
      hostname: 'localhost',
      port: 9001,
      path: '',
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
