import {createClient} from '@libsql/client/web';

export function databaseConfig(env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken || authToken === 'replace-with-your-database-token') throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the server environment.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('TURSO_DATABASE_URL must be a valid remote database URL.'); }
  if (!['libsql:','https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Use a libsql:// or https:// database URL without credentials or query parameters.');
  return {url, authToken};
}

// Keep the existing reward handler's small D1 interface on both hosting platforms.
export function adaptTurso(client) {
  return {prepare(sql) {
    const statement = args => ({
      bind(...values) { return statement(values); },
      async all() {
        const result = await client.execute({sql,args});
        return {results: result.rows.map(row => Object.fromEntries(result.columns.map(name => [name,row[name]])))};
      },
      async run() {
        const result = await client.execute({sql,args});
        return {success:true,meta:{changes:result.rowsAffected}};
      }
    });
    return statement([]);
  }};
}

let cached;
export function getDatabase(env = process.env) {
  const config = databaseConfig(env);
  if (!cached || cached.url !== config.url || cached.authToken !== config.authToken) {
    cached?.client.close();
    const client = createClient({...config, fetch: (input, init = {}) => fetch(input, {...init, signal: init.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000)})});
    cached = {...config,client,db:adaptTurso(client)};
  }
  return cached.db;
}
