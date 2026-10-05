import { describe, expect, it } from 'vitest';
import { filterMatchesTopic, isValidTopicFilter } from './topic-filter';

describe('filterMatchesTopic', () => {
  const cases: [topic: string, filter: string, expected: boolean][] = [
    ['$', '#', false],
    ['a', 'a', true],
    ['a', '#', true],
    ['a', 'a/#', true],
    ['a/b', 'a/#', true],
    ['a/b/c', 'a/#', true],
    ['b/c/d', 'a/#', false],
    ['a', 'a/+', false],
    ['a', '/a', false],
    ['a/b', 'a/b', true],
    ['a/b/c', 'a/+/c', true],
    ['a/b/c', 'a/+/d', false],
    ['#', '$SYS/#', false],
    ['a/b', 'a/+', true],
    ['a/b', 'a/b/#', true],
    ['a/b/c', 'a/b/c', true],
    ['$SYS/broker/uptime', '$SYS/#', true],
    ['a//c', 'a/+/c', false],
  ];

  it.each(cases)('topic %s against filter %s is %s', (topic, filter, expected) => {
    expect(filterMatchesTopic(filter, topic)).toBe(expected);
  });
});

describe('isValidTopicFilter', () => {
  const cases: [filter: string, expected: boolean][] = [
    ['a', true],
    ['a/b/c', true],
    ['#', true],
    ['a/#', true],
    ['+', true],
    ['a/+/c', true],
    ['+/+/#', true],
    ['/', true],
    ['a//b', true],
    ['$SYS/#', true],
    ['', false],
    ['a/#/b', false],
    ['#/a', false],
    ['a#', false],
    ['a/b#', false],
    ['a+/b', false],
    ['a/+b', false],
    ['a/\u0000/b', false],
  ];

  it.each(cases)('filter %j is valid: %s', (filter, expected) => {
    expect(isValidTopicFilter(filter)).toBe(expected);
  });
});
