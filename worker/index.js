import { dayAt, nextReset, quizFor, publicQuiz, grade, progress } from './domain.js';

const STATIC = /*STATIC*/ {};
const COOKIE = 'spark_session';
const SECURITY = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'", 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'};
function json(body, status = 200, headers = {}) { return new Response(JSON.stringify(body), {status, headers: {...SECURITY, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers}}); }
async function identity(request) {
  let token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  let fresh = !token || !/^[a-f0-9]{64}$/.test(token);
  if (fresh) token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
  const user = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2,'0')).join('');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {user, fresh, headers: fresh ? {'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`} : {}};
}
async function state(db, user, now) {
  const today = dayAt(now);
  const {results} = await db.prepare('SELECT day, points, correct, answers, created_at FROM completions WHERE user_id = ? ORDER BY day DESC').bind(user).all();
  const done = results.find(r => r.day === today);
  return {today, resetsAt: nextReset(now), serverNow: new Date(now).toISOString(), timezone: 'Asia/Kolkata', ...progress(results, today), completion: done ? {...done, answers: JSON.parse(done.answers), review: quizFor(today)} : null, history: results.map(({answers, ...row}) => row), challenge: publicQuiz(today)};
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), now = Date.now();
    if (url.pathname === '/api/health') return json({ok: true});
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) return json({error: 'Your progress is temporarily unavailable. Please try again.'}, 503);
      const id = await identity(request);
      try {
        if (url.pathname === '/api/state' && request.method === 'GET') return json(await state(env.DB, id.user, now), 200, id.headers);
        if (url.pathname === '/api/complete' && request.method === 'POST') {
          if (request.headers.get('Origin') !== url.origin) return json({error: 'Please open the challenge in this app.'}, 403);
          // A freshly minted identity cannot submit: the browser must first accept its session cookie.
          if (id.fresh) return json({error: 'Please allow cookies, then reload the challenge.'}, 401, id.headers);
          if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error: 'Send answers as JSON.'}, 415);
          if (Number(request.headers.get('Content-Length') || 0) > 2048) return json({error: 'That request is too large.'}, 413);
          const text = await request.text();
          if (text.length > 2048) return json({error: 'That request is too large.'}, 413);
          let body;
          try { body = JSON.parse(text); } catch { return json({error: 'We could not read those answers. Please try again.'}, 400); }
          if (!body || typeof body !== 'object') return json({error: 'Please send your challenge answers.'}, 400);
          if (body.day !== dayAt(now)) return json({error: 'A new day has started. Reload to try the new challenge.', code: 'DAY_CHANGED'}, 409);
          let result;
          try { result = grade(body.day, body.answers); } catch (error) { return json({error: error.message}, 400); }
          const insert = await env.DB.prepare('INSERT INTO completions (user_id, day, points, correct, answers, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, day) DO NOTHING').bind(id.user, body.day, result.points, result.correct, JSON.stringify(body.answers), new Date(now).toISOString()).run();
          return json({...(await state(env.DB, id.user, now)), alreadyClaimed: insert.meta.changes === 0}, 200);
        }
        return json({error: 'This page could not be found.'}, 404, id.headers);
      } catch (error) {
        console.error('Daily Spark request failed', error instanceof Error ? error.message : 'Unknown database error');
        return json({error: 'We could not confirm your progress. Please try again. Your points will only be added once.'}, 503, id.headers);
      }
    }
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {...SECURITY, Allow: 'GET, HEAD'}});
    const asset = STATIC[path];
    if (!asset) return new Response('Page not found', {status: 404, headers: SECURITY});
    return new Response(request.method === 'HEAD' ? null : asset.body, {headers: {...SECURITY, 'Content-Type': asset.type, 'Cache-Control': 'no-cache'}});
  }
};
