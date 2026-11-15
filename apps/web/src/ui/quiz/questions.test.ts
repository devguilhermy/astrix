import { describe, expect, it } from 'bun:test';
import { QUIZ_QUESTIONS, QUIZ_TOPICS, questionsFor, quizScore } from './questions';

describe('quiz question bank', () => {
  it('has unique ids and a valid answer in both languages', () => {
    expect(new Set(QUIZ_QUESTIONS.map(question => question.id)).size).toBe(QUIZ_QUESTIONS.length);
    for (const question of QUIZ_QUESTIONS) {
      expect(QUIZ_TOPICS).toContain(question.topic);
      expect(question.en.options.length).toBeGreaterThanOrEqual(3);
      expect(question.pt.options.length).toBe(question.en.options.length);
      expect(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.en.options.length).toBe(true);
      for (const text of [question.en, question.pt]) {
        expect(text.question.trim().length).toBeGreaterThan(0);
        expect(text.why.trim().length).toBeGreaterThan(0);
        expect(new Set(text.options).size).toBe(text.options.length);
        for (const option of text.options) expect(option.trim().length).toBeGreaterThan(0);
      }
    }
  });
  it('covers both topics and does not always put the answer in the same place', () => {
    for (const topic of QUIZ_TOPICS) expect(questionsFor(topic).length).toBeGreaterThanOrEqual(10);
    expect(questionsFor('all').length).toBe(QUIZ_QUESTIONS.length);
    for (const topic of QUIZ_TOPICS) expect(new Set(questionsFor(topic).map(question => question.answer)).size).toBe(3);
  });
  it('scores only answered questions', () => {
    const [first, second, third] = QUIZ_QUESTIONS;
    const answers = { [first!.id]: first!.answer, [second!.id]: (second!.answer + 1) % 3 };
    expect(quizScore([first!, second!, third!], answers)).toEqual({ answered: 2, correct: 1, total: 3 });
    expect(quizScore(questionsFor('astrix'), answers)).toEqual({ answered: 0, correct: 0, total: questionsFor('astrix').length });
  });
});
