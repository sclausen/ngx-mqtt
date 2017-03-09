import {
  ChangeDetectorRef,
  Component,
  Input,
  NgModule,
  Pipe,
  PipeTransform
} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { Observable } from 'rxjs/Observable';

import {
  MqttMessage,
  MqttModule,
  MqttService,
  OnMessageEvent
} from 'angular2-mqtt';

@Pipe({ name: 'keys', pure: false })
export class KeysPipe implements PipeTransform {
  transform(map: { [key: string]: any }): string[] {
    return Object.keys(map);
  }
}

@Pipe({ name: 'stateToString' })
export class StateToStringPipe implements PipeTransform {
  private states = [
    'CLOSED',
    'CONNECTING',
    'CONNECTED'
  ];

  transform(state: number): string {
    return `${this.states[state]} (${state})`;
  }
}

@Component({
  selector: 'mqtt-simple',
  template: `
    <button type="button" class="btn btn-default" (click)="click()" [ngClass]="{'btn-danger':!msgs,'btn-success':!!msgs}">
      <span *ngIf="!msgs">{{filter}}</span>
      <span *ngIf="!!msgs">{{(msgs | async)?.topic}}: {{(msgs| async)?.payload.toString().substr(0,32)}}</span>
    </button>
  `
})
export class MqttSimpleComponent {
  @Input() public filter: string;
  public msgs: Observable<MqttMessage> = null;

  constructor(private mqttService: MqttService, private cdRef: ChangeDetectorRef) { }

  public click() {
    if (!this.msgs) {
      this.msgs = this.mqttService.observe(this.filter);
    } else {
      this.msgs = null;
    }
    this.cdRef.detectChanges();
  }
}

@Component({
  selector: 'mqtt-connection',
  template: `
    <h2>Connection</h2>
    <table class="table">
      <tr>
        <th>Connection</th>
        <td>{{(mqtt.state | async) | stateToString}}</td>
      </tr>
    </table>

    <h2>Observers</h2>
    <mqtt-simple filter="#"></mqtt-simple>
    <mqtt-simple filter="$SYS/#"></mqtt-simple>

    <h2>Subscriptions</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Filter</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let filter of mqtt.observables | keys">
          <td>{{filter}}</td>
        </tr>
      </tbody>
    </table>

    <form name="publishForm">
      <div class="form-group">
        <label for="topic">Topic</label>
        <input type="text" class="form-control" id="topic" name="topic" [(ngModel)]="topic">
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea class="form-control" id="message" name="message" [(ngModel)]="message"></textarea>
      </div>
      <button type="submit" class="btn btn-default" (click)="publish(topic, message)">Publish</button>
    </form>
  `
})
export class MqttConnectComponent {
  public topic: string;
  public message: string;
  constructor(public mqtt: MqttService) { }

  public publish(topic: string, message: string) {
    this.mqtt.publish(topic, message, { qos: 1 }).subscribe((err) => {
      console.log(err);
    });
  }
}

@Component({
  selector: 'mqtt-example',
  template: `
    <mqtt-connection></mqtt-connection>
  `
})
export class ExampleComponent {
  constructor(private _mqttService: MqttService) {
    _mqttService.connect();
    _mqttService.onConnect.subscribe((e) => {
      console.log('onConnect', e);
    });
    _mqttService.onError.subscribe((e) => {
      console.log('onError', e);
    });
    _mqttService.onClose.subscribe(() => {
      console.log('onClose');
    });
    _mqttService.onReconnect.subscribe(() => {
      console.log('onReconnect');
    });
    _mqttService.onMessage.subscribe((e) => {
      console.log('onMessage', e);
    });
  }
}

export const MQTT_SERVICE_OPTIONS = {
  connectOnCreate: false,
  hostname: 'localhost',
  port: 9001,
  protocol: 'ws',
  path: '/mqtt'
};

export function mqttServiceFactory() {
  return new MqttService(MQTT_SERVICE_OPTIONS);
}

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    MqttModule.forRoot({
      provide: MqttService,
      useFactory: mqttServiceFactory
    })
  ],
  declarations: [
    ExampleComponent,
    MqttSimpleComponent,
    MqttConnectComponent,
    KeysPipe,
    StateToStringPipe
  ],
  providers: [],
  bootstrap: [
    ExampleComponent
  ]
})

export class DemoModule { }
