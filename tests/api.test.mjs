import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, unlinkSync} from 'node:fs';
import worker from '../worker/index.js';
import {dayAt, quizFor} from '../worker/domain.js';
import {openDatabase} from '../scripts/database.mjs';
const origin='https://spark.test';
async function call(db,path,options={}) {
  return worker.fetch(new Request(origin+path,options),{DB:db});
}
async function session(db) {
  const response=await call(db,'/api/state');
  return {cookie:response.headers.get('Set-Cookie').split(';')[0],state:await response.json()};
}
function post(cookie, day, answers, extra={}) { return {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({day,answers,...extra})}; }
test('new profiles start empty and receive a secure private cookie',async()=>{
  const db=openDatabase();
  try {
    const r=await call(db,'/api/state'); const d=await r.json();
    assert.equal(r.status,200);assert.equal(d.points,0);assert.equal(d.completion,null);assert.equal(d.challenge.length,3);
    assert.match(r.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);assert.match(r.headers.get('Set-Cookie'),/Secure/);
    assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok(d.challenge.every(q=>!('answer' in q)));
  } finally {db.sqlite.close();}
});
test('the server ignores client points, stores one result, and reveals review after completion',async()=>{
  const db=openDatabase();
  try {
    const {cookie,state}=await session(db);const answers=quizFor(state.today).map(q=>q.answer);
    const r=await call(db,'/api/complete',post(cookie,state.today,answers,{points:999999,correct:999,streak:100}));
    const d=await r.json();assert.equal(r.status,200);assert.equal(d.points,25);assert.equal(d.streak,1);assert.equal(d.completion.correct,3);assert.equal(d.completion.review.length,3);assert.equal(d.history.length,1);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM completions').get().n,1);
    const raw=db.sqlite.prepare('SELECT user_id FROM completions').get();assert.ok(!cookie.includes(raw.user_id));
  } finally {db.sqlite.close();}
});
test('twenty simultaneous repeats award points once and keep the original score',async()=>{
  const db=openDatabase();
  try {
    const {cookie,state}=await session(db);const correct=quizFor(state.today).map(q=>q.answer), wrong=correct.map(n=>(n+1)%3);
    await call(db,'/api/complete',post(cookie,state.today,wrong));
    const results=await Promise.all(Array.from({length:20},()=>call(db,'/api/complete',post(cookie,state.today,correct)).then(r=>r.json())));
    assert.ok(results.every(r=>r.points===10 && r.alreadyClaimed && r.completion.correct===0));
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM completions').get().n,1);
  } finally {db.sqlite.close();}
});
test('two browser identities cannot see or replace each other’s rewards',async()=>{
  const db=openDatabase();
  try {
    const a=await session(db),b=await session(db);
    await call(db,'/api/complete',post(a.cookie,a.state.today,quizFor(a.state.today).map(q=>q.answer)));
    const r=await call(db,'/api/state',{headers:{Cookie:b.cookie}});const d=await r.json();
    assert.equal(d.points,0);assert.equal(d.completion,null);assert.equal(d.history.length,0);
  } finally {db.sqlite.close();}
});
test('malformed, missing and out-of-range answers never write a reward',async()=>{
  const db=openDatabase();
  try {
    const {cookie,state}=await session(db);
    for(const body of ['{','null',JSON.stringify({day:state.today}),JSON.stringify({day:state.today,answers:[0,1,4]})]) {
      const options=post(cookie,state.today,[0,1,2]);options.body=body;
      assert.equal((await call(db,'/api/complete',options)).status,400);
    }
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM completions').get().n,0);
  } finally {db.sqlite.close();}
});
test('cross-origin, missing-cookie and oversized submissions are rejected',async()=>{
  const db=openDatabase();
  try {
    const {cookie,state}=await session(db);
    const cross=post(cookie,state.today,[0,1,2]);cross.headers.Origin='https://other.test';assert.equal((await call(db,'/api/complete',cross)).status,403);
    assert.equal((await call(db,'/api/complete',post('',state.today,[0,1,2]))).status,401);
    const huge=post(cookie,state.today,[0,1,2],{padding:'a'.repeat(3000)});assert.equal((await call(db,'/api/complete',huge)).status,413);
    const type=post(cookie,state.today,[0,1,2]);type.headers['Content-Type']='text/plain';assert.equal((await call(db,'/api/complete',type)).status,415);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM completions').get().n,0);
  } finally {db.sqlite.close();}
});
test('old or future challenge days cannot be claimed',async()=>{
  const db=openDatabase();
  try {
    const {cookie}=await session(db);
    for(const day of ['2020-01-01','2099-01-01']) {const r=await call(db,'/api/complete',post(cookie,day,[0,1,2]));assert.equal(r.status,409);assert.equal((await r.json()).code,'DAY_CHANGED');}
  } finally {db.sqlite.close();}
});
test('a response lost after committing can be retried without adding a second reward',async()=>{
  const db=openDatabase();
  try {
    const {cookie,state}=await session(db);const a=quizFor(state.today).map(q=>q.answer); const original=db.prepare;
    let didInsert=false;
    db.prepare=sql=> { if(sql.startsWith('SELECT') && didInsert) {didInsert=false;throw new Error('simulated response failure');} const statement=original(sql);if(sql.startsWith('INSERT')) {const run=statement.run;statement.run=async()=>{const r=await run.call(statement);didInsert=true;return r;};}return statement;};
    assert.equal((await call(db,'/api/complete',post(cookie,state.today,a))).status,503);
    db.prepare=original;
    const d=await (await call(db,'/api/complete',post(cookie,state.today,a))).json();assert.equal(d.points,25);assert.equal(d.alreadyClaimed,true);assert.equal(d.history.length,1);
  } finally {db.sqlite.close();}
});
test('SQLite persistence survives closing and reopening the server database',async()=>{
  mkdirSync('.data',{recursive:true});const filename=`.data/test-${process.pid}-${Date.now()}.sqlite`;let db=openDatabase(filename);
  try { const {cookie,state}=await session(db);await call(db,'/api/complete',post(cookie,state.today,quizFor(state.today).map(q=>q.answer)));db.sqlite.close();db=openDatabase(filename);const d=await (await call(db,'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(d.points,25);assert.equal(d.completedDays,1); }
  finally {db.sqlite.close();unlinkSync(filename);}
});
test('missing database returns a recoverable error instead of invented progress',async()=>{
  const r=await worker.fetch(new Request(origin+'/api/state'),{});assert.equal(r.status,503);assert.equal((await r.json()).points,undefined);
});
