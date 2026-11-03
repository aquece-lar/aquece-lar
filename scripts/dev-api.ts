/**
 * API local para desenvolver sem a Vercel: o mesmo roteador da função em
 * api/, servido em http://localhost:3001 (o Vite repassa /api para cá).
 *   npm run dev:api
 */
import { createServer } from 'node:http';
import { handle } from '../api/_lib/router.js';

const PORT = 3001;

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
  const response = await handle(request, url.pathname.replace(/^\/api\/?/, ''));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`API local em http://localhost:${PORT}/api`));
