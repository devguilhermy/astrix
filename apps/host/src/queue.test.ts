import { expect, spyOn, test } from 'bun:test';
import { RoomQueue } from './clock';

test('a throwing job is logged and never stops later jobs or the queue', () => {
  const pending: (() => void)[] = [], ran: string[] = [], queue = new RoomQueue(8, job => { pending.push(job); });
  const log = spyOn(console, 'error').mockImplementation(() => {});
  queue.enqueue(() => { throw new RangeError('hostile payload'); });
  queue.enqueue(() => { ran.push('after'); });
  while (pending.length) pending.shift()!();
  expect(ran).toEqual(['after']);
  expect(log).toHaveBeenCalled();
  expect(queue.enqueue(() => { ran.push('later'); })).toBe(true);
  while (pending.length) pending.shift()!();
  expect(ran).toEqual(['after', 'later']);
  log.mockRestore();
});
