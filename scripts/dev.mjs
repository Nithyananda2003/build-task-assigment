import './build.mjs';
import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import {openDatabase} from './database.mjs';
const {default: worker} = await import('../dist/server/index.js');
mkdirSync('.data', {recursive: true});
const DB = openDatabase('.data/spark.sqlite');
const port = Number(process.env.PORT || 4173);
const server = createServer(async (req, res) => {
  try {
    const body = [];
    for await (const chunk of req) { body.push(chunk); if (body.reduce((n,c) => n + c.length,0) > 4096) {res.writeHead(413); res.end('Too large'); return;} }
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {method: req.method, headers: req.headers, ...(!['GET','HEAD'].includes(req.method) ? {body: Buffer.concat(body)} : {})});
    const response = await worker.fetch(request, {DB});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end('Please try again.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Daily Spark ready at http://127.0.0.1:${port}`));
function shutdown() { server.close(() => { DB.sqlite.close(); process.exit(); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
