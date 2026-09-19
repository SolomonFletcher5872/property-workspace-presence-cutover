import { createServer } from 'node:http';
import { ZodError } from 'zod';
import { InfraiError } from './infrai_client.js';
import { issueWorkspaceToken, syncWorkspacePresence } from './workspace_presence_service.js';

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/workspace/sync') {
      const input = await readJson(req);
      const status = await syncWorkspacePresence(input);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(status, null, 2));
      return;
    }

    if (req.method === 'POST' && req.url === '/workspace/token') {
      const input = await readJson(req) as Record<string, unknown>;
      const clientId = typeof input.clientId === 'string' ? input.clientId : '';
      const token = await issueWorkspaceToken(input, clientId);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(token, null, 2));
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (error) {
    if (error instanceof ZodError) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid request', issues: error.issues }, null, 2));
      return;
    }

    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.code, message: error.message }, null, 2));
      return;
    }

    const message = error instanceof Error ? error.message : 'unexpected error';
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: message }, null, 2));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`workspace presence service listening on http://localhost:${port}`);
});
