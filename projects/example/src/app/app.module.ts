import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MqttModule } from 'ngx-mqtt';

import { AppComponent } from './app.component';
import { PublishComponent } from './publish.component';
import { FormsModule } from '@angular/forms';
import { SubscribeComponent } from './subscribe.component';

@NgModule({
  declarations: [AppComponent, PublishComponent, SubscribeComponent],
  imports: [
    BrowserModule,
    FormsModule,
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
