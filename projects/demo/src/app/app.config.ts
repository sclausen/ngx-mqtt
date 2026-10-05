import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideMqtt } from 'ngx-mqtt';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideMqtt({ url: 'ws://localhost:9001', logLevel: 'info' }),
  ],
};
