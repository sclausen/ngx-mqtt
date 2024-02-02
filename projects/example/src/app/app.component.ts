import { Component, OnInit } from '@angular/core';
import { MqttService } from 'ngx-mqtt';

@Component({
  selector: 'app-root',
  template: `
    <table>
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
  `,
})
export class AppComponent implements OnInit {
  public data: Record<string, string> = {};

  constructor(public readonly mqttService: MqttService) {}

  ngOnInit(): void {
    this.mqttService.observe('ngx-mqtt/tests/#').subscribe((message) => {
      console.log({ message });
      this.data[message.topic] = message.payload.toString();
    });
  }
}
