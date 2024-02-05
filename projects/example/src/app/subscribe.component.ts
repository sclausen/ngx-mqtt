import { Component } from '@angular/core';
import { MqttService } from 'ngx-mqtt';
import { QoS } from 'mqtt-packet';
import { Subscription } from 'rxjs';

interface SubscriptionInfo {
  topic: string;
  qos: number;
}

@Component({
  selector: 'app-subscribe-message',
  template: `
    <div>
      <h3>Subscribe</h3>
      <form (submit)="subscribe()">
        <label for="topicFilter"
          >Topic Filter
          <input
            type="text"
            id="topicFilter"
            [(ngModel)]="topicFilter"
            name="topicFilter"
            required
          />
        </label>

        <label for="qos"
          >QoS
          <select id="qos" [(ngModel)]="qos" name="qos">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <button type="submit">Subscribe</button>
      </form>

      <h3>Subscriptions</h3>
      <table role="grid">
        <thead>
          <tr>
            <th scope="col">Topic Filter</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let topic of subscriptions | keyvalue">
            <td>
              <div role="group">
                <button (click)="unsubscribe(topic.key)">&times;</button>
                <input readonly type="text" [value]="topic.key" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class SubscribeComponent {
  topicFilter: string = '';
  qos: QoS = 0;
  public subscriptions: { [topic: string]: Subscription } = {};

  constructor(private mqttService: MqttService) {}

  subscribe(): void {
    if (!this.topicFilter) {
      return;
    }

    if (this.subscriptions[this.topicFilter]) {
      return;
    }

    const subscription = this.mqttService
      .observe(this.topicFilter, { qos: this.qos })
      .subscribe({
        next: (message) => {
          console.log('Received message:', message);
        },
        error: (error) => console.error('Subscription error:', error),
      });

    this.subscriptions[this.topicFilter] = subscription;

    this.topicFilter = '';
    this.qos = 0;
  }

  unsubscribe(topic: string): void {
    this.subscriptions[topic].unsubscribe();
    delete this.subscriptions[topic];
  }

  ngOnDestroy(): void {
    Object.values(this.subscriptions).forEach((subscription) =>
      subscription.unsubscribe()
    );
  }
}
