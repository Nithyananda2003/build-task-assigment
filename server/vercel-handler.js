import worker from '../worker/index.js';
import {getDatabase} from './turso.js';

export function createVercelHandler(database = getDatabase) {
  return {async fetch(request) {
    // Liveness should still work while a new deployment is being configured.
    if (new URL(request.url).pathname === '/api/health') return worker.fetch(request,{});
    let DB;
    try { DB = database(); }
    catch {
      console.error('Daily Spark database is not configured. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      return worker.fetch(request,{}); // Shared JSON 503 response; no token or stack exposed.
    }
    return worker.fetch(request,{DB});
  }};
}

export default createVercelHandler();
