import { Component, OnInit } from '@angular/core';
import { MqttService } from 'ngx-mqtt';

@Component({
  selector: 'app-root',
  template: `
    <main class="container">
      <div class="grid">
        <div>
          <app-publish-message></app-publish-message>
        </div>
        <div>
          <app-subscribe-message></app-subscribe-message>
        </div>
      </div>
      <div>
        <h3>Messages</h3>
        <table role="grid">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tr *ngFor="let topic of data | keyvalue">
            <td>{{ topic.key }}</td>
            <td>{{ topic.value }}</td>
          </tr>
        </table>
      </div>
    </main>
  `,
})
export class AppComponent implements OnInit {
  public data: Record<string, string> = {};

  constructor(public readonly mqttService: MqttService) {}

  ngOnInit(): void {
    this.mqttService.onMessage.subscribe((message) => {
      this.data[message.topic] = message.payload.toString();
    });
  }
}
