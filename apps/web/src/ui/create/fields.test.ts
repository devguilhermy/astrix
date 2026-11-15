import { expect, test } from 'bun:test';
import { getAt, setAt, tokens } from './fields';

test('JSON paths address nested fields and array items', () => {
  expect(tokens('objectives[2].spec.minAltKm')).toEqual(['objectives', 2, 'spec', 'minAltKm']);
  const root = { objectives: [{ spec: { a: 1 } }, { spec: { a: 2 } }] };
  expect(getAt(root, 'objectives[1].spec.a')).toBe(2);
  expect(getAt(root, 'objectives[5].spec.a')).toBeUndefined();
});
test('setAt is immutable and shares untouched branches', () => {
  const root = { name: { text: 'A' }, objectives: [{ id: 'a', spec: { n: 1 } }, { id: 'b', spec: { n: 2 } }] };
  const next = setAt(root, 'objectives[1].spec.n', 9);
  expect(getAt(next, 'objectives[1].spec.n')).toBe(9);
  expect(getAt(root, 'objectives[1].spec.n')).toBe(2);
  expect(next.objectives[0]).toBe(root.objectives[0]);
  expect(next.name).toBe(root.name);
});
test('setAt creates missing containers for new paths', () => {
  expect(getAt(setAt({}, 'a.b[1]', 'x'), 'a.b[1]')).toBe('x');
  expect(Array.isArray(getAt(setAt({}, 'a.b[1]', 'x'), 'a.b'))).toBe(true);
});
