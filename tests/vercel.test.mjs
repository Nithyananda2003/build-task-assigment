import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,unlinkSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createClient} from '@libsql/client';
import {adaptTurso,databaseConfig} from '../server/turso.js';
import {createVercelHandler} from '../server/vercel-handler.js';
import {applyMigrations} from '../scripts/migrate-turso.mjs';
import {quizFor} from '../worker/domain.js';
import healthRoute from '../api/health.js';
import stateRoute from '../api/state.js';
import completeRoute from '../api/complete.js';

const origin='https://daily-spark-test.vercel.app';
async function setup() {const client=createClient({url:'file::memory:'});await applyMigrations(client);return {client,handler:createVercelHandler(()=>adaptTurso(client))};}
async function session(handler) {const r=await handler.fetch(new Request(origin+'/api/state'));assert.equal(r.status,200);return {cookie:r.headers.get('Set-Cookie').split(';')[0],state:await r.json()};}
function completion(cookie,state,answers) {return new Request(origin+'/api/complete',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({day:state.today,answers})});}

test('Vercel route files expose Web Request handlers and health needs no database',async()=>{
  for(const route of [healthRoute,stateRoute,completeRoute]) assert.equal(typeof route.fetch,'function');
  const r=await healthRoute.fetch(new Request(origin+'/api/health'));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
});
test('database configuration requires a remote TLS URL and a server-only token',()=>{
  for(const env of [{},{TURSO_DATABASE_URL:'file:local.db',TURSO_AUTH_TOKEN:'test'}, {TURSO_DATABASE_URL:'http://db.test',TURSO_AUTH_TOKEN:'test'}, {TURSO_DATABASE_URL:'libsql://db.test?authToken=test',TURSO_AUTH_TOKEN:'test'}]) assert.throws(()=>databaseConfig(env));
  assert.deepEqual(databaseConfig({TURSO_DATABASE_URL:'libsql://db.test',TURSO_AUTH_TOKEN:'test-token'}),{url:'libsql://db.test',authToken:'test-token'});
});
test('missing database configuration returns JSON without revealing credentials',async()=>{
  const handler=createVercelHandler(()=>{throw new Error('private-token-should-not-appear');});
  const r=await handler.fetch(new Request(origin+'/api/state'));
  assert.equal(r.status,503);assert.match(r.headers.get('Content-Type'),/application\/json/);
  const text=await r.text();assert.doesNotMatch(text,/private-token|stack|TURSO_AUTH_TOKEN/);assert.match(text,/temporarily unavailable/);
});
test('the libSQL SDK applies migrations once and catches edited migration history',async()=>{
  const client=createClient({url:'file::memory:'});
  try {
    assert.equal(await applyMigrations(client),1);assert.equal(await applyMigrations(client),0);
    assert.equal((await client.execute('SELECT COUNT(*) AS n FROM _spark_migrations')).rows[0].n,1);
    await client.execute("UPDATE _spark_migrations SET sha256 = 'changed'");
    await assert.rejects(applyMigrations(client),/has changed/);
  } finally {client.close();}
});
test('Vercel handler and libSQL preserve authoritative scoring and atomic replay',async()=>{
  const {client,handler}=await setup();
  try {
    const {cookie,state}=await session(handler);
    const correct=quizFor(state.today).map(q=>q.answer),wrong=correct.map(n=>(n+1)%3);
    const initial=await handler.fetch(completion(cookie,state,wrong));const result=await initial.json();
    assert.equal(initial.status,200);assert.equal(result.points,10);assert.equal(result.alreadyClaimed,false);
    const repeats=await Promise.all(Array.from({length:8},async()=>{
      const response=await handler.fetch(completion(cookie,state,correct));assert.equal(response.status,200);return response.json();
    }));
    assert.ok(repeats.every(r=>r.points===10&&r.alreadyClaimed&&r.completion.correct===0));
    assert.equal((await client.execute('SELECT COUNT(*) AS n FROM completions')).rows[0].n,1);
    const row=result.history[0];assert.deepEqual(Object.keys(row).sort(),['correct','created_at','day','points']);
    assert.match(initial.headers.get('Cache-Control'),/no-store/);
  } finally {client.close();}
});
test('Vercel requests still enforce origin and browser isolation with libSQL',async()=>{
  const {client,handler}=await setup();
  try {
    const a=await session(handler),b=await session(handler);
    const cross=completion(a.cookie,a.state,[0,1,2]);cross.headers.set('Origin','https://untrusted.test');
    assert.equal((await handler.fetch(cross)).status,403);
    await handler.fetch(completion(a.cookie,a.state,quizFor(a.state.today).map(q=>q.answer)));
    const r=await handler.fetch(new Request(origin+'/api/state',{headers:{Cookie:b.cookie}}));
    assert.equal((await r.json()).points,0);
  } finally {client.close();}
});
test('Turso adapter survives new server instances using persistent SQL records',async()=>{
  mkdirSync('.data',{recursive:true});const file=resolve(`.data/libsql-test-${process.pid}-${Date.now()}.sqlite`);
  let client=createClient({url:pathToFileURL(file).href});
  try {
    await applyMigrations(client);let handler=createVercelHandler(()=>adaptTurso(client));const {cookie,state}=await session(handler);
    await handler.fetch(completion(cookie,state,quizFor(state.today).map(q=>q.answer)));
    client.close();client=createClient({url:pathToFileURL(file).href});handler=createVercelHandler(()=>adaptTurso(client));
    assert.equal(await applyMigrations(client),0);
    const saved=await (await handler.fetch(new Request(origin+'/api/state',{headers:{Cookie:cookie}}))).json();
    assert.equal(saved.points,25);assert.equal(saved.completedDays,1);assert.equal(saved.streak,1);
  } finally {
    client.close();
    // libSQL's native Windows handle can outlive close until the process exits.
    // The uniquely named fixture lives in ignored .data; a cleanup lock is not a persistence failure.
    try {unlinkSync(file);} catch(error) {if(error.code !== 'EBUSY') throw error;}
  }
});
test('a libSQL connection failure is a recoverable JSON response, not fabricated points',async()=>{
  const {client,handler}=await setup();client.close();
  const r=await handler.fetch(new Request(origin+'/api/state'));assert.equal(r.status,503);
  const result=await r.json();assert.equal(result.points,undefined);assert.match(result.error,/could not confirm/);
});
test('Vercel build routes static files and all three APIs without a catch-all rewrite',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.framework,null);assert.equal(config.buildCommand,'npm run build:vercel');assert.equal(config.outputDirectory,'dist/vercel');assert.equal(config.rewrites,undefined);
  assert.equal(JSON.parse(readFileSync('package.json')).engines.node,'24.x');
  assert.ok(readFileSync('.gitignore','utf8').includes('!.env.example'));
});
