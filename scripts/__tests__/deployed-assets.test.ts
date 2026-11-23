/** Exercise the deployment health check against the responses a browser gets
 * when nginx serves a page but denies a chunk or returns an HTML fallback. */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('requires readable CSS and JavaScript with the correct content types', async () => {
  let jsStatus = 403;
  let jsType = 'text/html';
  const server = createServer((req, res) => {
    switch (req.url) {
      case '/ru/login':
        res.setHeader('content-type', 'text/html');
        res.end(
          '<link href="/_next/static/app.css" rel="stylesheet"><script src="/_next/static/app.js"></script>'
        );
        break;
      case '/_next/static/app.css':
        res.writeHead(200, { 'content-type': 'text/css' }).end('body{}');
        break;
      case '/_next/static/app.js':
        res.writeHead(jsStatus, { 'content-type': jsType }).end('test');
        break;
      default:
        res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('missing test port');
    }

    const check = () =>
      promisify(execFile)('python3', [
        'scripts/check-deployed-assets.py',
        `http://127.0.0.1:${address.port}`,
      ]);
    await expect(check()).rejects.toThrow(/403/);
    jsStatus = 200;
    await expect(check()).rejects.toThrow(/text\/html/);
    jsType = 'application/javascript';
    await expect(check()).resolves.toMatchObject({
      stdout: expect.stringContaining('2 assets'),
    });
  } finally {
    server.close();
  }
});
