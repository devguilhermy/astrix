import { expect, test } from 'bun:test';
import { RoomQueue } from './clock';
test('mailbox serializes commitments, yields each transaction and reserves safety capacity',()=>{
 const scheduled:(()=>void)[]=[],order:string[]=[];const queue=new RoomQueue(4,job=>scheduled.push(job));
 expect(queue.enqueue(()=>order.push('proposal'))).toBe(true);expect(queue.enqueue(()=>order.push('commit'))).toBe(true);expect(queue.enqueue(()=>order.push('retry'))).toBe(true);expect(queue.enqueue(()=>order.push('overflow'))).toBe(false);
 expect(queue.enqueue(()=>order.push('disconnect'),true)).toBe(true);expect(queue.enqueue(()=>order.push('overflow-safety'),true)).toBe(false);expect(order).toEqual([]);
 scheduled.shift()!();expect(order).toEqual(['disconnect']);while(scheduled.length)scheduled.shift()!();expect(order).toEqual(['disconnect','proposal','commit','retry']);
});
