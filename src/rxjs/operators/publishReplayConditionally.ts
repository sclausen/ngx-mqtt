import {
  ConnectableObservable,
  MonoTypeOperatorFunction,
  Observable,
  OperatorFunction,
  SchedulerLike,
  UnaryFunction
} from 'rxjs';

import { ConditionalReplaySubject } from '../CoditionalReplaySubject';
import { multicast } from 'rxjs/internal/operators/multicast';

/* tslint:disable:max-line-length */
export function publishReplayConditionally<T>(bufferSize?: number, windowTime?: number, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;
export function publishReplayConditionally<T, R>(bufferSize?: number, windowTime?: number, selector?: OperatorFunction<T, R>, scheduler?: SchedulerLike): OperatorFunction<T, R>;
export function publishReplayConditionally<T>(bufferSize?: number, windowTime?: number, selector?: MonoTypeOperatorFunction<T>, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;
export function publishReplayConditionally<T>(bufferSize?: number, windowTime?: number, selector?: MonoTypeOperatorFunction<T>, scheduler?: SchedulerLike, expression?: (value: T) => boolean): MonoTypeOperatorFunction<T>;
/* tslint:enable:max-line-length */

export function publishReplayConditionally<T, R>(bufferSize?: number,
  windowTime?: number,
  selectorOrScheduler?: SchedulerLike | OperatorFunction<T, R>,
  scheduler?: SchedulerLike,
  expression?: (value: T) => boolean): UnaryFunction<Observable<T>, ConnectableObservable<R>> {

  if (selectorOrScheduler && typeof selectorOrScheduler !== 'function') {
    scheduler = selectorOrScheduler;
  }

  const selector = typeof selectorOrScheduler === 'function' ? selectorOrScheduler : undefined;
  const subject = new ConditionalReplaySubject<T>(bufferSize, windowTime, scheduler, expression);

  return (source: Observable<T>) => multicast(() => subject, selector)(source) as ConnectableObservable<R>;
}