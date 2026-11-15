import { expect, test } from 'bun:test';
import type { TimelineForecast } from '@astrix/core';
import { nextTimelineEdge } from './FlightSummary';
const forecast:TimelineForecast={startSec:100,endSec:800,windows:[
 {kind:'CONTACT',startSec:500,endSec:600},{kind:'SUNLIGHT',startSec:100,endSec:300},
 {kind:'ECLIPSE',startSec:300,endSec:700},{kind:'EVENT',startSec:120,endSec:121},
 {kind:'SUNLIGHT',startSec:700,endSec:800},
]};
test('summary selects the earliest actual next light, shadow or contact start, independent of lane order',()=>{
 expect(nextTimelineEdge(forecast,100)).toEqual({kind:'ECLIPSE',time:300});
 expect(nextTimelineEdge(forecast,300)).toEqual({kind:'CONTACT',time:500});
 expect(nextTimelineEdge(forecast,600)).toEqual({kind:'SUNLIGHT',time:700});
});
test('unknown or exhausted timeline remains unknown, not an invented edge',()=>{
 expect(nextTimelineEdge(null,100)).toBeNull();expect(nextTimelineEdge(forecast,800)).toBeNull();
});
