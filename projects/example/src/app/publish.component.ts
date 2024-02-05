import { Component } from '@angular/core';
import { MqttService } from 'ngx-mqtt';
import { QoS } from 'mqtt-packet';

@Component({
  selector: 'app-publish-message',
  template: `
    <div>
      <h3>Publish</h3>
      <form (ngSubmit)="publishMessage()">
        <label for="topic"
          >Topic
          <input
            type="text"
            id="topic"
            [(ngModel)]="topic"
            name="topic"
            required
          />
        </label>

        <label for="message">
          Message
          <textarea
            id="message"
            [(ngModel)]="message"
            name="message"
            required
          ></textarea>
        </label>

        <div>
          <label for="qos">QoS</label>
          <select id="qos" [(ngModel)]="qos" name="qos">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </div>
        <fieldset>
          <label for="retain">
            <input
              type="checkbox"
              id="retain"
              [(ngModel)]="retain"
              name="retain"
              role="switch"
            />
            Retain
          </label>
        </fieldset>
        <button type="submit">Publish</button>
      </form>
    </div>
  `,
})
export class PublishComponent {
  topic: string = '';
  message: string = '';
  qos: QoS = 0;
  retain: boolean = false;

  constructor(private mqttService: MqttService) {}

  publishMessage(): void {
    if (!this.topic || !this.message) {
      alert('Topic and message are required');
      return;
    }

    this.mqttService
      .publish(this.topic, this.message, { qos: this.qos, retain: this.retain })
      .then(() => {
        alert('Message published successfully');
      })
      .catch((error) => {
        console.error('Error publishing message:', error);
        alert('Failed to publish message');
      });
  }
}
