import { expect, test } from 'bun:test';
import { HostClock, RoomQueue } from './clock';
test('monotonic scheduling bounds chunks and refuses laptop-sleep catch-up',()=>{
 let now=0,stalls=0;const ticks:number[]=[];const clock=new HostClock(dt=>ticks.push(dt),()=>stalls++,()=>now);
 clock.pulse();now=350;clock.pulse();expect(ticks).toEqual([.1,.1,.1,.05]);now=300;clock.pulse();expect(ticks.length).toBe(4);now=400;clock.pulse();expect(ticks.at(-1)).toBe(.05);now=60000;clock.pulse();expect(stalls).toBe(1);expect(ticks.length).toBe(5);now=60100;clock.pulse();expect(ticks.at(-1)).toBe(.1);
});
test('mailbox serializes intents and ticks, yields each transaction and reserves safety capacity',()=>{
 const scheduled:(()=>void)[]=[],order:string[]=[];const queue=new RoomQueue(4,job=>scheduled.push(job));
 expect(queue.enqueue(()=>order.push('intent-1'))).toBe(true);expect(queue.enqueue(()=>order.push('tick'))).toBe(true);expect(queue.enqueue(()=>order.push('intent-2'))).toBe(true);expect(queue.enqueue(()=>order.push('overflow'))).toBe(false);
 expect(queue.enqueue(()=>order.push('host-stall'),true)).toBe(true);expect(queue.enqueue(()=>order.push('overflow-safety'),true)).toBe(false);expect(order).toEqual([]);
 scheduled.shift()!();expect(order).toEqual(['host-stall']);while(scheduled.length)scheduled.shift()!();expect(order).toEqual(['host-stall','intent-1','tick','intent-2']);
});
