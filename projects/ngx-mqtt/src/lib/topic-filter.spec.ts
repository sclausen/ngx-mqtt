import { describe, expect, it } from 'vitest';
import { filterMatchesTopic } from './topic-filter';

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
