import { inject, TestBed } from '@angular/core/testing';
import { MqttService } from '../src/mqtt.service';

describe('MqttService', () => {
  it('is defined', () => {
    expect(MqttService).toBeDefined();
  });
});

describe('MqttService.filterMatchesTopic', () => {
  it('is defined', () => {
    expect(MqttService.filterMatchesTopic).toBeDefined();
  });
  const matches: any = [
    ['$',     '#',       false],
    ['a',     'a',       true],
    ['a',     '#',       true],
    ['a',     'a/#',     true],
    ['a/b',   'a/#',     true],
    ['a/b/c', 'a/#',     true],
    ['b/c/d', 'a/#',    false],
    ['a',     'a/+',    false],
    ['a',     '/a',     false],
    ['a/b',   'a/b',     true],
    ['a/b/c', 'a/+/c',   true],
    ['a/b/c', 'a/+/d',  false],
    ['#',     '$SYS/#', false],
    ['a/b',   'a/+',     true],
    ['a/b',   'a/#',     true],
    ['a/b',   'a/b/#',   true],
    ['a/b/c', 'a/b/c',   true],
  ];
  for (let i = 0; i < matches.length; i++) {
    it(`${matches[i][0]} matches ${matches[i][1]}: ${matches[i][2]}`, () => {
      expect(MqttService.filterMatchesTopic(matches[i][1], matches[i][0])).toBe(matches[i][2]);
    });
  }
});
