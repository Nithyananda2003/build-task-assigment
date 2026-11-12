import {cpSync,mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {databaseConfig} from '../server/turso.js';

// Fail at build time with actionable setup instructions on Vercel. Local builds need no cloud account.
if (process.env.VERCEL === '1') databaseConfig(process.env);
const config=JSON.parse(readFileSync('vercel.json','utf8'));
if(config.outputDirectory !== 'dist/vercel') throw new Error('Unexpected Vercel output directory.');
mkdirSync(config.outputDirectory,{recursive:true});
for(const entry of readdirSync('public',{withFileTypes:true})) {
  if(!entry.isFile()) throw new Error('Public assets must be regular files.');
  cpSync('public/'+entry.name,config.outputDirectory+'/'+entry.name);
}
console.log('Vercel static assets ready in dist/vercel. API routes use the shared handler and remote Turso database.');
