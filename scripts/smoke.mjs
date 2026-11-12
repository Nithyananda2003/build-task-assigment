// Deliberately writes one anonymous demo completion to the selected instance.
import assert from 'node:assert/strict';
import {quizFor} from '../worker/domain.js';
const base = new URL(process.argv[2] || 'http://127.0.0.1:4173');
if(!['https:','http:'].includes(base.protocol)) throw new Error('Supply an HTTP(S) app origin.');
const first = await fetch(new URL('/api/state',base));
assert.equal(first.status,200);const initial=await first.json();
const cookie=first.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
assert.equal(initial.points,0);assert.equal(initial.completion,null);
assert.ok(initial.challenge.every(q=>!('answer' in q)));
const options={method:'POST',headers:{Origin:base.origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({day:initial.today,answers:quizFor(initial.today).map(q=>q.answer),points:999999})};
const submit=async()=>{const response=await fetch(new URL('/api/complete',base),options);assert.equal(response.status,200);return response.json();};
const completed=await submit();assert.equal(completed.points,25);assert.equal(completed.history.length,1);assert.equal(completed.alreadyClaimed,false);
const repeats=await Promise.all([submit(),submit(),submit()]);assert.ok(repeats.every(d=>d.points===25 && d.history.length===1 && d.alreadyClaimed));
const saved=await (await fetch(new URL('/api/state',base),{headers:{Cookie:cookie}})).json();
assert.equal(saved.points,25);assert.equal(saved.streak,1);assert.equal(saved.completedDays,1);assert.equal(saved.badges.filter(b=>b.earned).length,2);
console.log('Live smoke passed: new browser profile, server-owned scoring, persisted 25 points, 3 concurrent replays with one reward, streak and 2 badges.');
