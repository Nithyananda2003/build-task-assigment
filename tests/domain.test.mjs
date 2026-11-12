import test from 'node:test';
import assert from 'node:assert/strict';
import {dayAt, nextReset, previousDay, publicQuiz, quizFor, grade, progress} from '../worker/domain.js';

test('the day changes at midnight IST, independently of host timezone', () => {
  assert.equal(dayAt(Date.parse('2026-11-12T18:29:59.999Z')), '2026-11-12');
  assert.equal(dayAt(Date.parse('2026-11-12T18:30:00Z')), '2026-11-13');
  assert.equal(nextReset(Date.parse('2026-11-12T18:29:59Z')), '2026-11-12T18:30:00.000Z');
  assert.equal(nextReset(Date.parse('2026-11-12T18:30:00Z')), '2026-11-13T18:30:00.000Z');
});
test('calendar rollover handles year and leap day', () => {
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
  assert.equal(previousDay('2028-03-01'), '2028-02-29');
});
test('daily challenges are deterministic, vary by day, and do not leak solutions', () => {
  assert.deepEqual(quizFor('2026-11-12'), quizFor('2026-11-12'));
  assert.notDeepEqual(publicQuiz('2026-11-12'), publicQuiz('2026-11-13'));
  for (let i=0;i<365;i++) {
    const day = new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10);
    const qs = quizFor(day);
    assert.equal(new Set(qs.map(q => q.word)).size, 3);
    qs.forEach(q => assert.ok(q.answer>=0 && q.answer<q.choices.length));
    publicQuiz(day).forEach(q => assert.deepEqual(Object.keys(q), ['word','choices']));
  }
});
test('scoring gives completion points, plus exactly five per correct answer', () => {
  const day = '2026-11-12', answers = quizFor(day).map(q => q.answer);
  assert.equal(grade(day,answers).points,25);
  for(let correct=0;correct<=3;correct++) {
    const a = answers.map((n,i)=>i<correct?n:(n+1)%3);
    assert.equal(grade(day,a).correct,correct);
    assert.equal(grade(day,a).points,10+5*correct);
  }
});
test('incomplete and forged answer values are rejected', () => {
  for(const a of [null,{},[],[0,1],[0,1,2,0],[0,1,3],[-1,0,0],[0,'1',2],[null,0,1],[true,0,1],[.5,0,1]]) assert.throws(()=>grade('2026-11-12',a));
});
const row = (day,correct=3) => ({day,correct,points:10+5*correct});
test('a new learner has zero points, no badges, and level one', () => {
  const p = progress([], '2026-11-12');
  assert.equal(p.streak,0); assert.equal(p.points,0); assert.equal(p.level,1); assert.equal(p.toNextLevel,100); assert.ok(p.badges.every(b=>!b.earned));
});
test('a streak counts today or yesterday, and resets only after a full missed day', () => {
  const rows = ['2026-11-10','2026-11-11','2026-11-12'].map(d=>row(d));
  assert.equal(progress(rows,'2026-11-12').streak,3);
  assert.equal(progress(rows,'2026-11-13').streak,3);
  assert.equal(progress(rows,'2026-11-14').streak,0);
  assert.equal(progress([row('2026-11-12'),row('2026-11-10')],'2026-11-12').streak,1);
});
test('points and previously earned badges survive a broken streak', () => {
  const rows = Array.from({length:7},(_,i)=>row(`2026-11-${10+i}`));
  const p = progress(rows,'2026-11-19');
  assert.equal(p.streak,0);assert.equal(p.points,175);assert.ok(p.badges.every(b=>b.earned));
});
test('levels advance exactly at each 100 points', () => {
  const rows = Array.from({length:4},(_,i)=>row(`2026-11-${10+i}`));
  const p = progress(rows,'2026-11-13');
  assert.equal(p.level,2);assert.equal(p.levelProgress,0);assert.equal(p.toNextLevel,100);
  assert.equal(progress(rows.slice(0,3),'2026-11-12').levelProgress,75);
});
