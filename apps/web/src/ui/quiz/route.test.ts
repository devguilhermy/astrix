import { expect, test } from 'bun:test';
import { isKnownLocation, isQuizPath, readLocationView } from '../recovery/routes';

test('the quiz has its own path under the deployed base and no simulator view', () => {
  expect(isQuizPath('/quiz')).toBe(true);
  expect(isQuizPath('/astrix/quiz', '/astrix/')).toBe(true);
  expect(isQuizPath('/quiz/extra')).toBe(false);
  expect(isQuizPath('/quizzes')).toBe(false);
  expect(isKnownLocation('/quiz', '')).toBe(true);
  expect(isKnownLocation('/quiz', '#play')).toBe(false);
  expect(readLocationView('/quiz', '')).toBe('explore');
});
