import http from 'node:http';
import { watchFile, unwatchFile } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles } from './public-files.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const publicRoutes = new Map(publicFiles.filter(file => !file.startsWith('.')).map(file => [`/${file}`, file]));
publicRoutes.set('/', 'index.html');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const clients = new Set();
let revision = Date.now();
let debounce;

// This script exists only in local HTTP responses, never in publishable HTML.
const liveScript = `(() => {
  let revision;
  const events = new EventSource('/__preview/events');
  events.onmessage = event => {
    if (revision !== undefined && revision !== event.data) location.reload();
    revision = event.data;
  };
  window.addEventListener('pagehide', () => events.close(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();`;
const liveTag = '<script src="/__preview/live.js"></script>';
const withLiveReload = body => /<\/body>/i.test(body) ? body.replace(/<\/body>/i, `${liveTag}</body>`) : body + liveTag;

async function readPublic(file) {
  const target = path.join(root, file);
  // An allowed filename must not be a symlink to private material.
  if (await realpath(target) !== target) throw new Error('Not public');
  return readFile(target);
}

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__preview/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      if (request.method === 'HEAD') return response.end();
      clients.add(response);
      response.write(`data: ${revision}\n\n`);
      const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 15000);
      response.on('close', () => { clearInterval(heartbeat); clients.delete(response); });
      return;
    }
    if (pathname === '/__preview/live.js') {
      response.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return response.end(request.method === 'HEAD' ? undefined : liveScript);
    }
    const file = publicRoutes.get(pathname);
    if (!file) throw new Error('Not public');
    let body = await readPublic(file);
    if (file.endsWith('.html')) body = withLiveReload(body.toString());
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    let body = '<h1>Page not found</h1>';
    try { body = (await readPublic('404.html')).toString(); } catch { /* Still respond if the file is being saved. */ }
    response.writeHead(404, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : withLiveReload(body));
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. If your preview is running, open http://127.0.0.1:${port}/. Otherwise try PORT=${port + 1} npm run dev.`
    : error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  for (const file of publicFiles) {
    watchFile(path.join(root, file), { interval: 250 }, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        revision++;
        for (const client of clients) client.write(`data: ${revision}\n\n`);
        console.log('Saved changes detected; refreshing preview.');
      }, 120);
    });
  }
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Local preview: ${url}\nSave index.html or an asset to refresh the browser automatically. Stop with Ctrl-C.`);
  if (process.argv.includes('--open') && process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore' }).on('error', () => console.log(`Open ${url} in your browser.`));
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearTimeout(debounce);
    for (const file of publicFiles) unwatchFile(path.join(root, file));
    for (const client of clients) client.end();
    server.close();
    server.closeAllConnections();
  });
}
