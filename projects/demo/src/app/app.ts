import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MqttConnectionState, MqttService } from 'ngx-mqtt';
import type { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>ngx-mqtt demo</h1>
    <p>State: {{ state() }}</p>
    <section>
      <input #filterInput value="ngx-mqtt/demo/#" aria-label="Filter" />
      <button type="button" (click)="subscribe(filterInput.value)">Subscribe</button>
    </section>
    <section>
      <input #topicInput value="ngx-mqtt/demo/hello" aria-label="Topic" />
      <input #payloadInput value="hello" aria-label="Payload" />
      <button type="button" (click)="publish(topicInput.value, payloadInput.value)">Publish</button>
    </section>
    <ul>
      @for (message of messages(); track $index) {
        <li>{{ message }}</li>
      }
    </ul>
  `,
})
export class App {
  private readonly mqtt = inject(MqttService);
  private subscription: Subscription | undefined;

  protected readonly state = computed(() => MqttConnectionState[this.mqtt.connectionState()]);
  protected readonly messages = signal<string[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected subscribe(filterString: string): void {
    this.subscription?.unsubscribe();
    this.messages.set([]);
    this.subscription = this.mqtt.observe(filterString).subscribe((message) => {
      const line = `${message.topic}: ${new TextDecoder().decode(message.payload)}`;
      this.messages.update((list) => [line, ...list].slice(0, 50));
    });
  }

  protected publish(topic: string, payload: string): void {
    this.mqtt.unsafePublish(topic, payload);
  }
}
