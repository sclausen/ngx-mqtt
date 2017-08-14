import { Component, ChangeDetectorRef } from '@angular/core';
import { MqttService, MqttMessage } from 'ngx-mqtt';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

export type QoS = 0 | 1 | 2;

@Component({
  selector: 'app-root',
  template: `
    <div class="panel panel-default">
      <div class="panel-heading">
        <h3 class="panel-title">
          <i class="fa fa-circle" [ngClass]="(state | async) | stateToClass"></i>
          {{(state | async) | stateToString}}
        </h3>
      </div>
    </div>

    <div class="panel panel-default">
      <div class="panel-heading">
        <h3 class="panel-title">Subscriptions</h3>
      </div>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Filter</th>
            <th>Payload</th>
            <th>Topic</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let filter of observables | keys">
            <td class="col-sm-4">
            <button 
              *ngIf="!!observables[filter]"
              (click)="unsubscribe(filter)"
              class="btn btn-xs btn-danger"><i class="fa fa-times"></i>
            </button> {{filter}}</td>
            <td class="col-sm-4">{{(observables[filter] | async)?.payload.toString().substr(0, 32)}}</td>
            <td class="col-sm-4">{{(observables[filter] | async)?.topic}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row">
      <div class="col-sm-6">
        <div class="panel panel-default">
          <div class="panel-heading">
            <h3 class="panel-title">Publish</h3>
          </div>
          <div class="panel-body">
            <form name="publishForm">
              <div class="form-group">
                <label for="topic">Topic</label>
                <input type="text" class="form-control" id="topic" name="topic" [(ngModel)]="topic">
              </div>
              <div class="form-group">
                <label for="message">Message</label>
                <textarea class="form-control" id="message" name="message" [(ngModel)]="message"></textarea>
              </div>
              <div class="form-group">
                <div class="checkbox">
                  <label>
                    <input type="checkbox" id="retained" name="retained" [(ngModel)]="retain"> Retain
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label for="qos">QoS</label>
                <select class="form-control" id="qos" name="qos"  [(ngModel)]="qos">
                  <option>0</option>
                  <option>1</option>
                  <option value="2">2 (Not supported in every broker)</option>
                </select>
              </div>
              <button type="submit" class="btn btn-default" (click)="publish(topic, message, retain, qos)">Publish</button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-sm-6">
        <div class="panel panel-default">
          <div class="panel-heading">
            <h3 class="panel-title">Subscribe</h3>
          </div>
          <div class="panel-body">
            <form name="publishForm">
              <div class="form-group">
                <label for="filter">Filter</label>
                <input type="text" class="form-control" id="filter" name="filter" [(ngModel)]="filter">
              </div>
              <button type="submit" class="btn btn-default" (click)="subscribe(filter)">Subscribe</button>
            </form>
          </div>
        </div>
      </div>
    </div>
    
  `,
  styles: []
})
export class AppComponent {
  public topic: string;
  public retain: boolean;
  public qos: QoS = 0;
  public filter: string;
  public message: string;

  public get state() {
    return this.mqtt.state;
  }

  public get observables() {
    return this.mqtt.observables;
  }

  constructor(private mqtt: MqttService, private cdRef: ChangeDetectorRef) {
    mqtt.onConnect.subscribe((e) => console.log('onConnect', e));
    mqtt.onError.subscribe((e) => console.log('onError', e));
    mqtt.onClose.subscribe(() => console.log('onClose'));
    mqtt.onReconnect.subscribe(() => console.log('onReconnect'));
    mqtt.onMessage.subscribe((e) => console.log('onMessage', e));
  }

  public publish(topic: string, message: string, retain = false, qos: QoS = 0): void {
    this.mqtt
      .publish(topic, message, { retain, qos })
      .subscribe((err) => console.log(err));
  }

  public subscribe(filter: string): void {
    this.mqtt.observe(filter);
  }

  public unsubscribe(filter: string): void {
    this.mqtt.observables[filter] = null;
  }
}
