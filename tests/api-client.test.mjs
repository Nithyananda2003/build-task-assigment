import test from 'node:test';
import assert from 'node:assert/strict';
import {requestApi} from '../public/api-client.js';
import worker from '../worker/index.js';
import {openDatabase} from '../scripts/database.mjs';
const json = (data, status = 200) => Response.json(data,{status});
const noWait = async () => {};
async function validResponse() { const DB = openDatabase(); try {return await (await worker.fetch(new Request('https://spark.test/api/state'),{DB})).json();} finally {DB.sqlite.close();} }

test('a plain-text hosting error recovers automatically when the next read succeeds',async()=>{
  const state=await validResponse();let calls=0;
  const result=await requestApi('/api/state',{}, {pause:noWait,fetcher:async()=>++calls===1?new Response('The page could not be found',{status:404}):json(state)});
  assert.equal(calls,2);assert.equal(result.points,0);
});
test('persistent non-JSON responses show a readable error after bounded retries',async()=>{
  let calls=0;
  await assert.rejects(requestApi('/api/state',{}, {pause:noWait,fetcher:async()=>{calls++;return new Response('<html>Bad gateway</html>',{status:502,headers:{'Content-Type':'text/html'}});}}), error=>{assert.match(error.message,/taking a moment/);assert.doesNotMatch(error.message,/Unexpected token|HTML|JSON|gateway/i);return true;});
  assert.equal(calls,3);
});
test('malformed JSON and invalid success payloads cannot overwrite saved state',async()=>{
  for(const make of [()=>new Response('The page could not be found',{headers:{'Content-Type':'application/json'}}),()=>json(null),()=>json({ok:true})]) {
    await assert.rejects(requestApi('/api/state',{}, {pause:noWait,fetcher:async()=>make()}),/taking a moment/);
  }
});
test('a failed submission is never automatically sent twice',async()=>{
  let calls=0;
  await assert.rejects(requestApi('/api/complete',{method:'POST'}, {pause:noWait,fetcher:async()=>{calls++;return new Response('The page could not be found',{status:503});}}),/taking a moment/);
  assert.equal(calls,1);
});
test('valid day-change errors preserve the recovery code and do not retry',async()=>{
  let calls=0;
  await assert.rejects(requestApi('/api/complete',{method:'POST'}, {pause:noWait,fetcher:async()=>{calls++;return json({error:'A new day has started.',code:'DAY_CHANGED'},409);}}),error=>error.message==='A new day has started.' && error.code==='DAY_CHANGED');
  assert.equal(calls,1);
});
test('network read failures can recover without being called offline',async()=>{
  const state=await validResponse();let calls=0;
  const result=await requestApi('/api/state',{}, {pause:noWait,fetcher:async()=>{if(++calls===1)throw new TypeError('fetch failed');return json(state);}});
  assert.equal(calls,2);assert.equal(result.completedDays,0);
});
test('authentication failures are reported directly without retrying the request',async()=>{
  let calls=0;
  await assert.rejects(requestApi('/api/state',{}, {pause:noWait,fetcher:async()=>{calls++;return json({error:'Please allow cookies, then reload.'},401);}}),/Please allow cookies/);
  assert.equal(calls,1);
});
