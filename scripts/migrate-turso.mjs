import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createClient} from '@libsql/client/web';
import {databaseConfig} from '../server/turso.js';

export async function applyMigrations(client, directory = new URL('../drizzle/',import.meta.url)) {
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json',directory),'utf8'));
  await client.execute('CREATE TABLE IF NOT EXISTS _spark_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL)');
  let applied=0;
  for(const entry of journal.entries) {
    if(!/^[a-zA-Z0-9_-]+$/.test(entry.tag)) throw new Error('Invalid migration tag.');
    const sql=await readFile(new URL(entry.tag+'.sql',directory),'utf8');
    const checksum=createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
    const existing=await client.execute({sql:'SELECT sha256 FROM _spark_migrations WHERE name = ?',args:[entry.tag]});
    if(existing.rows.length) {
      if(existing.rows[0].sha256 !== checksum) throw new Error(`Applied migration ${entry.tag} has changed. Append a new migration instead.`);
      continue;
    }
    const statements=sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(sql=>({sql,args:[]}));
    await client.batch([...statements,{sql:'INSERT INTO _spark_migrations (name, sha256, applied_at) VALUES (?, ?, ?)',args:[entry.tag,checksum,new Date().toISOString()]}],'write');
    applied++;
  }
  return applied;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    client=createClient(databaseConfig(process.env));
    console.log(`Database ready. Applied ${await applyMigrations(client)} new migration(s).`);
  } catch { console.error('Database migration failed. Check the Turso libSQL URL, token, connectivity, and immutable migration history. No credentials are printed.'); process.exitCode=1; }
  finally {client?.close();}
}
