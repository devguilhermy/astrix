import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { CommandQueueEntry } from '@astrix/core';
import { english } from '../../i18n/resources';
import { CommandReceipt } from './FlightControls';

const i18n=createInstance();
await i18n.init({lng:'en',resources:{en:{translation:english}},keySeparator:false,interpolation:{escapeValue:false}});
function receipt(patch:Partial<CommandQueueEntry>={}) {
 const entry:CommandQueueEntry={id:'request-1',command:{kind:'POINT',mode:'EARTH'},actor:{role:'ALL'},transport:'GROUND',issuedAt:12,transmittedAt:null,applyAt:null,resolvedAt:null,expiresAt:172812,status:'WAITING_CONTACT',...patch};
 return renderToStaticMarkup(<I18nextProvider i18n={i18n}><ol><CommandReceipt entry={entry} parts={[]}/></ol></I18nextProvider>);
}
describe('command request lifecycle shown to the operator',()=>{
 test('contact waiting is not a refusal or an invented arrival',()=>{
  const html=receipt();
  expect(html).toContain('Waiting for uplink contact');
  expect(html).not.toContain('Refused at receipt');
  expect(html).not.toContain('<dt>Arrival</dt>');
  expect(html).not.toContain('<dt>Transmitted</dt>');
  expect(html).toContain('<dt>Valid until</dt>');
 });
 test('in-transit request distinguishes issue, transmission and expected arrival',()=>{
  const html=receipt({status:'IN_TRANSIT',transmittedAt:100,applyAt:900});
  expect(html).toContain('In transit');
  expect(html).toContain('<dt>Issued</dt>');
  expect(html).toContain('<dt>Transmitted</dt>');
  expect(html).toContain('<dt>Arrival</dt>');
  expect(html).not.toContain('<dt>Result</dt>');
 });
 test('expired waiting request is never presented as delivered or still travelling',()=>{
  const html=receipt({status:'EXPIRED',resolvedAt:172812});
  expect(html).toContain('Expired');
  expect(html).toContain('<dt>Result</dt>');
  expect(html).not.toContain('<dt>Arrival</dt>');
  expect(html).not.toContain('Delivered');
 });
});
