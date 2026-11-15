import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Meter } from './index';

function accessibility(html: string) {
  return Object.fromEntries([...html.matchAll(/\b(role|aria-valuenow|aria-valuemin|aria-valuemax)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

test('science return exceeding its goal remains a valid completed progress indicator', () => {
  const html = renderToStaticMarkup(<Meter intent="progress" label="Returned science" value={1706.25} limit={1500} detail="113.8%" />);
  expect(accessibility(html)).toEqual({ role: 'progressbar', 'aria-valuenow': '1500', 'aria-valuemin': '0', 'aria-valuemax': '1500' });
  expect(html).toContain('113.8%');
});

test('battery reserve exposes remaining energy rather than a completion goal', () => {
  const html = renderToStaticMarkup(<Meter intent="reserve" label="Battery" value={60} limit={60} />);
  expect(accessibility(html)).toEqual({ role: 'meter', 'aria-valuenow': '60', 'aria-valuemin': '0', 'aria-valuemax': '60' });
});

test('overflow keeps the real text value but never exposes an out-of-range accessible meter', () => {
  const html = renderToStaticMarkup(<Meter label="Storage" value={2200} limit={2000} detail="2200 MB / 2000 MB" />);
  expect(accessibility(html)['aria-valuenow']).toBe('2000');
  expect(html).toContain('2200 MB / 2000 MB');
});
