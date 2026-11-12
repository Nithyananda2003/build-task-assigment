import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
// Minimal D1 compatibility adapter. Transactions use the same SQL as production.
export function openDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
  if (!sqlite.prepare('SELECT name FROM _migrations WHERE name = ?').get('0000_daily_spark')) {
    sqlite.exec('BEGIN');
    try { sqlite.exec(readFileSync(new URL('../drizzle/0000_daily_spark.sql', import.meta.url),'utf8')); sqlite.prepare('INSERT INTO _migrations VALUES (?)').run('0000_daily_spark'); sqlite.exec('COMMIT'); }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  }
  return {sqlite, prepare(sql) {
    let values = [];
    return {bind(...args) { values = args; return this; }, async all() { return {results: sqlite.prepare(sql).all(...values)}; }, async run() {const r = sqlite.prepare(sql).run(...values); return {success: true, meta: {changes: Number(r.changes)}}; }};
  }};
}
