import { Pipe, PipeTransform } from '@angular/core';

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

@Pipe({ name: 'stateToClass' })
export class StateToClassPipe implements PipeTransform {
  private states = [
    'text-danger',
    'text-warn',
    'text-success'
  ];

  transform(state: number): string {
    return `${this.states[state]} (${state})`;
  }
}