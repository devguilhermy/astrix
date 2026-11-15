import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, RotateCcw, X } from 'lucide-react';
import { SiteHeader, type SiteNavigation } from '../landing/SiteHeader';
import { questionsFor, quizScore, type QuizFilter, type QuizQuestion } from './questions';
import '../landing/home.css';
import './quiz.css';

const copy = {
  en: { title: 'Mission design quiz', intro: 'Check what you know about designing a space mission and about how ASTRIX11 works. Each answer comes with its reason. Nothing here is scored in the game.',
    enter: 'Enter the simulator', topic: 'Topic', mode: 'Mode', all: 'All questions', design: 'Mission design', astrix: 'How ASTRIX11 works',
    quiz: 'Answer questions', study: 'Read the answers', progress: (current: number, total: number) => `Question ${current} of ${total}`, correct: 'Correct.', wrong: 'Not quite. The answer is:',
    previous: 'Previous', next: 'Next question', finish: 'See the result', choose: 'Choose an answer to continue.', result: 'Your result', outOf: (correct: number, total: number) => `${correct} of ${total} correct`,
    perfect: 'Every answer is correct.', good: 'You have the essentials. The answers you missed are marked below.', retryNote: 'Read the reasons below, then try again.', again: 'Try again',
    yours: 'Your answer', answer: 'Answer', review: 'All answers' },
  pt: { title: 'Quiz de projeto de missões', intro: 'Confira o que você sabe sobre projetar uma missão espacial e sobre como o ASTRIX11 funciona. Cada resposta vem com sua razão. Nada aqui conta pontos no jogo.',
    enter: 'Entrar no simulador', topic: 'Tema', mode: 'Modo', all: 'Todas as perguntas', design: 'Projeto de missões', astrix: 'Como o ASTRIX11 funciona',
    quiz: 'Responder perguntas', study: 'Ler as respostas', progress: (current: number, total: number) => `Pergunta ${current} de ${total}`, correct: 'Correto.', wrong: 'Não exatamente. A resposta é:',
    previous: 'Anterior', next: 'Próxima pergunta', finish: 'Ver o resultado', choose: 'Escolha uma resposta para continuar.', result: 'Seu resultado', outOf: (correct: number, total: number) => `${correct} de ${total} corretas`,
    perfect: 'Todas as respostas estão corretas.', good: 'Você domina o essencial. As respostas que errou estão marcadas abaixo.', retryNote: 'Leia as razões abaixo e tente de novo.', again: 'Tentar de novo',
    yours: 'Sua resposta', answer: 'Resposta', review: 'Todas as respostas' },
} as const;

const FILTERS: readonly QuizFilter[] = ['all', 'design', 'astrix'];
const LETTERS = 'ABCD';

/** Standalone study page at `<base>quiz`. It reads no mission state and writes nothing: answers live only in this component. */
export function Quiz({ base, onEnter, ...navigation }: SiteNavigation & { base: string; onEnter: () => void }) {
  const { i18n } = useTranslation(), lang = i18n.resolvedLanguage?.startsWith('pt') ? 'pt' : 'en', c = copy[lang];
  const [filter, setFilter] = useState<QuizFilter>('all'), [mode, setMode] = useState<'quiz' | 'study'>('quiz');
  const [index, setIndex] = useState(0), [answers, setAnswers] = useState<Record<string, number>>({}), [finished, setFinished] = useState(false);
  const questions = questionsFor(filter), question = questions[Math.min(index, questions.length - 1)]!, chosen = answers[question.id], score = quizScore(questions, answers);
  const heading = useRef<HTMLHeadingElement>(null), moved = useRef(false);
  useEffect(() => { document.title = `${c.title} · ASTRIX11`; document.documentElement.lang = i18n.resolvedLanguage ?? 'en'; }, [c.title, i18n.resolvedLanguage]);
  // After Next, Previous, a finished run or a restart, focus follows the content that replaced the old question.
  useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = false; }, [index, finished, mode, filter]);
  const go = (next: number) => { moved.current = true; setIndex(next); };
  const restart = () => { moved.current = true; setAnswers(current => Object.fromEntries(Object.entries(current).filter(([id]) => !questions.some(item => item.id === id)))); setIndex(0); setFinished(false); };
  const chooseFilter = (next: QuizFilter) => { setFilter(next); setIndex(0); setFinished(false); };
  const topicLabel = (item: QuizQuestion) => c[item.topic];
  const reviewItem = (item: QuizQuestion, withChoice: boolean) => {
    const text = item[lang], mine = answers[item.id], missed = withChoice && mine !== undefined && mine !== item.answer;
    return <li key={item.id} data-missed={missed}>
      <p className="quiz-topic">{topicLabel(item)}</p><h3>{text.question}</h3>
      {missed && <p className="quiz-line wrong"><X size={18} aria-hidden="true"/><span><strong>{c.yours}:</strong> {text.options[mine]}</span></p>}
      <p className="quiz-line right"><Check size={18} aria-hidden="true"/><span><strong>{c.answer}:</strong> {text.options[item.answer]}</span></p>
      <p className="quiz-why">{text.why}</p>
    </li>;
  };
  return <main className="home-screen quiz-screen">
    <SiteHeader base={base} current="quiz" {...navigation}/>
    <section className="quiz-intro">
      <h1>{c.title}</h1><p>{c.intro}</p>
      <div className="quiz-controls">
        <div className="quiz-toggle" role="group" aria-label={c.topic}>{FILTERS.map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => chooseFilter(item)}>{c[item]} <span>{questionsFor(item).length}</span></button>)}</div>
        <div className="quiz-toggle" role="group" aria-label={c.mode}>{(['quiz', 'study'] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{c[item]}</button>)}</div>
      </div>
    </section>
    {mode === 'study' && <section className="quiz-review" aria-label={c.review}><ol>{questions.map(item => reviewItem(item, false))}</ol></section>}
    {mode === 'quiz' && !finished && <section className="quiz-card">
      <p className="quiz-progress"><span>{c.progress(index + 1, questions.length)}</span><span className="quiz-topic">{topicLabel(question)}</span></p>
      <progress max={questions.length} value={score.answered} aria-label={c.progress(score.answered, questions.length)}/>
      <fieldset>
        <legend><h2 ref={heading} tabIndex={-1}>{question[lang].question}</h2></legend>
        <div className="quiz-options">{question[lang].options.map((option, optionIndex) => {
          const state = chosen === undefined ? 'idle' : optionIndex === question.answer ? 'right' : optionIndex === chosen ? 'wrong' : 'rest';
          return <label key={optionIndex} className="quiz-option" data-state={state}>
            <input type="radio" name={`quiz-${question.id}`} checked={chosen === optionIndex} aria-disabled={chosen !== undefined && chosen !== optionIndex} onChange={() => { if (chosen === undefined) setAnswers(current => ({ ...current, [question.id]: optionIndex })); }}/>
            <span className="quiz-letter" aria-hidden="true">{LETTERS[optionIndex]}</span><span>{option}</span>
            {state === 'right' && <Check size={20} aria-hidden="true"/>}{state === 'wrong' && <X size={20} aria-hidden="true"/>}
          </label>;
        })}</div>
      </fieldset>
      <div className="quiz-feedback" role="status" aria-live="polite" data-state={chosen === undefined ? 'idle' : chosen === question.answer ? 'right' : 'wrong'}>
        {chosen === undefined ? <p className="quiz-hint">{c.choose}</p> : <>
          <p><strong>{chosen === question.answer ? c.correct : `${c.wrong} ${question[lang].options[question.answer]}`}</strong></p>
          <p>{question[lang].why}</p>
        </>}
      </div>
      <div className="quiz-actions">
        <button type="button" className="button" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={18} aria-hidden="true"/>{c.previous}</button>
        {index < questions.length - 1
          ? <button type="button" className="button primary" disabled={chosen === undefined} onClick={() => go(index + 1)}>{c.next}<ArrowRight size={18} aria-hidden="true"/></button>
          : <button type="button" className="button primary" disabled={score.answered < questions.length} onClick={() => { moved.current = true; setFinished(true); }}>{c.finish}<ArrowRight size={18} aria-hidden="true"/></button>}
      </div>
    </section>}
    {mode === 'quiz' && finished && <section className="quiz-result">
      <h2 ref={heading} tabIndex={-1}>{c.result}</h2>
      <p className="quiz-result-score">{c.outOf(score.correct, score.total)}</p>
      <p>{score.correct === score.total ? c.perfect : score.correct / score.total >= .7 ? c.good : c.retryNote}</p>
      <div className="quiz-actions"><button type="button" className="button" onClick={restart}><RotateCcw size={18} aria-hidden="true"/>{c.again}</button><button type="button" className="button primary" onClick={onEnter}>{c.enter}<ArrowUpRight size={18} aria-hidden="true"/></button></div>
      <div className="quiz-review"><ol>{questions.map(item => reviewItem(item, true))}</ol></div>
    </section>}
  </main>;
}
